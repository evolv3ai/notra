import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { MUTATIONS } from "./constants/mutations";
import type { MutationOutcome, MutationSuite } from "./types/mutations";

// Proves the suite catches real regressions: for every mutation in
// constants/mutations.ts it puts one bug into production code, runs the
// suites that must catch it, records where they failed and restores the file.
// A suite that stays green with a bug in place is reported as a survivor.
//
//   SITES_TEST_ENABLED=true SITES_TEST_DATABASE_URL=… \
//     bun --no-env-file apps/sites-e2e/scripts/mutation-check.ts [--only id,id]
//
// The lifecycle needs a migrated isolated PostgreSQL (scripts/testing/dashboard
// postgres.ts up + migrate.ts); it builds with the Box emulator.
const root = resolve(import.meta.dirname, "../../..");
const { values } = parseArgs({
  options: {
    only: { type: "string" },
    report: { type: "string" },
  },
});
const selected = values.only
  ? MUTATIONS.filter((mutation) =>
      values.only?.split(",").includes(mutation.id)
    )
  : MUTATIONS;
const suites = new Set(selected.flatMap((mutation) => mutation.suites));
if (suites.has("lifecycle") && !process.env.SITES_TEST_DATABASE_URL) {
  throw new Error("The lifecycle needs SITES_TEST_DATABASE_URL (see header).");
}

const originals = new Map<string, string>();
const restore = async () => {
  for (const [file, content] of originals) {
    await writeFile(join(root, file), content);
  }
  originals.clear();
};
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    restore().finally(() => process.exit(130));
  });
}

function run(command: string[], env: NodeJS.ProcessEnv) {
  return new Promise<number>((resolveRun) => {
    const child = spawn(command[0] ?? "", command.slice(1), {
      cwd: root,
      env,
      stdio: ["ignore", "ignore", "ignore"],
    });
    child.on("close", (code) => resolveRun(code ?? 1));
  });
}

async function runSuite(suite: MutationSuite) {
  const temp = await mkdtemp(join(tmpdir(), "notra-mutation-"));
  const report = join(temp, "report.json");
  const started = performance.now();
  try {
    if (suite === "unit") {
      // The Sites unit suites that run on every pull request.
      const code = await run(
        [
          process.execPath,
          "--no-env-file",
          "test",
          "packages/sites-core/tests",
          "packages/sites-server/tests",
        ],
        { PATH: process.env.PATH, HOME: process.env.HOME }
      );
      return {
        passed: code === 0,
        where: code === 0 ? null : "unit tests",
        error: null,
        durationMs: Math.round(performance.now() - started),
      };
    }
    const code =
      suite === "lifecycle"
        ? await run(
            [
              process.execPath,
              "--no-env-file",
              "test",
              "--timeout=60000",
              "apps/sites-e2e/tests/connected-lifecycle-postgres.test.ts",
            ],
            {
              ...process.env,
              DATABASE_URL: process.env.SITES_TEST_DATABASE_URL,
              SITES_E2E_LIFECYCLE_REPORT: report,
            }
          )
        : await run(
            [
              process.execPath,
              "--no-env-file",
              "apps/sites-e2e/src/run.ts",
              "--repetitions",
              "1",
              "--report",
              report,
            ],
            process.env
          );
    const json = existsSync(report)
      ? JSON.parse(await readFile(report, "utf8"))
      : null;
    return {
      passed: code === 0,
      where:
        suite === "lifecycle"
          ? (json?.failedPhase ?? json?.runningPhase ?? null)
          : (json?.failedAfter ?? null),
      error:
        String(json?.error ?? "")
          .split("\n")
          .find((line: string) => line.trim()) ?? null,
      durationMs: Math.round(performance.now() - started),
    };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

// The unmutated code must pass first, or a "caught" result means nothing.
for (const suite of suites) {
  const baseline = await runSuite(suite);
  console.error(`baseline ${suite}: ${baseline.passed ? "passed" : "FAILED"}`);
  if (!baseline.passed) {
    throw new Error(`Baseline ${suite} failed: ${baseline.error}`);
  }
}

const outcomes: MutationOutcome[] = [];
const notApplicable: string[] = [];
try {
  for (const mutation of selected) {
    const path = join(root, mutation.file);
    const original = existsSync(path) ? await readFile(path, "utf8") : "";
    if (original.split(mutation.find).length !== 2) {
      notApplicable.push(`${mutation.id}: target not found exactly once`);
      continue;
    }
    originals.set(mutation.file, original);
    await writeFile(path, original.replace(mutation.find, mutation.replace));
    try {
      for (const suite of mutation.suites) {
        const result = await runSuite(suite);
        outcomes.push({
          id: mutation.id,
          bug: mutation.bug,
          suite,
          caught: !result.passed,
          where: result.where,
          error: result.error,
          durationMs: result.durationMs,
        });
        console.error(
          `${result.passed ? "SURVIVED" : "caught  "} ${mutation.id} (${suite})${result.where ? ` in "${result.where}"` : ""}`
        );
      }
    } finally {
      await restore();
    }
  }
} finally {
  await restore();
}

const lines = [
  "| | Mutation | Suite | Failed at | First error |",
  "| --- | --- | --- | --- | --- |",
  ...outcomes.map(
    (outcome) =>
      `| ${outcome.caught ? "✅" : "❌"} | ${outcome.bug} (\`${outcome.id}\`) | ${outcome.suite} | ${outcome.suite === "browser" && outcome.where ? `after "${outcome.where}"` : (outcome.where ?? "–")} | ${(outcome.error ?? "–").replaceAll("|", "\\|").slice(0, 140)} |`
  ),
];
const survivors = outcomes.filter((outcome) => !outcome.caught);
const summary = {
  mutations: selected.length,
  runs: outcomes.length,
  caught: outcomes.length - survivors.length,
  survivors: survivors.map((outcome) => `${outcome.id} (${outcome.suite})`),
  notApplicable,
  outcomes,
};
if (values.report) {
  await writeFile(resolve(values.report), JSON.stringify(summary, null, 2));
}
process.stdout.write(`${lines.join("\n")}\n`);
process.exitCode = survivors.length || notApplicable.length ? 1 : 0;
