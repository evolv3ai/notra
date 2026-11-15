import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  existsSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { stageBoxToolchain } from "../scripts/utils/stage-box-toolchain";

const work = join(homedir(), ".capy/work");
mkdirSync(work, { recursive: true });
const scratch = mkdtempSync(join(work, "notra-toolchain-packaging-"));
const stage = join(scratch, "toolchain");
const root = resolve(import.meta.dir, "..");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  ASTRO_TELEMETRY_DISABLED: "1",
};

beforeAll(async () => {
  await stageBoxToolchain(stage);
});

afterAll(() => {
  try {
    const report = process.env.SITES_TOOLCHAIN_REPORT;
    if (report && existsSync(join(scratch, "report.json"))) {
      copyFileSync(join(scratch, "report.json"), resolve(report));
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("snapshot package contains theme runtime sources without workspace dependencies", () => {
  expect(existsSync(join(stage, "dist/cli.mjs"))).toBe(true);
  expect(existsSync(join(stage, "src/utils/public-assets.ts"))).toBe(true);
  expect(existsSync(join(stage, "src/constants/public-assets.ts"))).toBe(true);
  expect(existsSync(join(stage, "compiler"))).toBe(false);
  expect(existsSync(join(stage, "sites-core"))).toBe(false);
  const pkg = JSON.parse(readFileSync(join(stage, "package.json"), "utf8"));
  expect(pkg.dependencies).not.toHaveProperty("@notra/sites-core");
  expect(pkg).not.toHaveProperty("devDependencies");
  expect(readFileSync(join(stage, "VERSION"), "utf8").trim()).toMatch(
    /^[a-f0-9]{12}$/
  );
});

test("native snapshot cleans local outputs on staging/allocation failure and surfaces Box cleanup errors", async () => {
  const preload = join(scratch, "fail-box-cleanup.ts");
  writeFileSync(
    preload,
    `import { EphemeralBox } from ${JSON.stringify(join(root, "node_modules/@upstash/box/dist/index.js"))};
globalThis.fetch = async () => { throw new Error("Unexpected provider request"); };
EphemeralBox.create = async (config) => {
  if (config.ttl !== 600 || config.size !== "medium" || Object.keys(config.env).length) throw new Error("Unsafe allocation config");
  return {
    exec: { command: async () => ({ exitCode: 0 }) },
    files: { upload: async () => { throw new Error("Injected upload failure"); } },
    delete: async () => { throw new Error("Injected Box cleanup failure"); },
  };
};
`
  );
  for (const failure of ["stage", "allocate", "cleanup"] as const) {
    const tmp = join(scratch, `native-${failure}`);
    mkdirSync(tmp);
    const args = [process.execPath, "--no-env-file"];
    if (failure === "cleanup") {
      args.push("--preload", preload);
    }
    args.push(join(root, "scripts/create-box-snapshot.ts"));
    const child = Bun.spawn(args, {
      cwd: scratch,
      env: { ...env, PATH: failure === "stage" ? "" : env.PATH, TMPDIR: tmp },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    writeFileSync(join(scratch, `native-${failure}.log`), stdout + stderr, {
      mode: 0o600,
    });
    expect(exitCode).not.toBe(0);
    expect(readdirSync(tmp)).toEqual([]);
    if (failure === "allocate") {
      expect(stderr).toContain("apiKey is required");
    }
    if (failure === "cleanup") {
      expect(stderr).toContain("Injected Box cleanup failure");
    }
  }
}, 180_000);

test.skipIf(process.env.SITES_TOOLCHAIN_STANDALONE_TEST !== "1")(
  "standalone fixture fails without theme runtime sources then succeeds when restored",
  async () => {
    const install = Bun.spawn(
      [
        "npm",
        "install",
        "--omit=dev",
        "--no-audit",
        "--no-fund",
        "--loglevel=error",
      ],
      { cwd: stage, env, stdout: "pipe", stderr: "pipe" }
    );
    const [installOutput, installError, installExit] = await Promise.all([
      new Response(install.stdout).text(),
      new Response(install.stderr).text(),
      install.exited,
    ]);
    writeFileSync(join(scratch, "install.log"), installOutput + installError, {
      mode: 0o600,
    });
    expect(installExit).toBe(0);
    const results = [];
    for (const label of ["missing-runtime", "corrected"] as const) {
      const missing = join(stage, "src/utils/public-assets.ts");
      const moved = join(scratch, "temporarily-missing");
      if (label !== "corrected") {
        renameSync(missing, moved);
      }
      const started = performance.now();
      try {
        const child = Bun.spawn(
          [
            "node",
            join(stage, "dist/cli.mjs"),
            "build",
            "--source",
            join(root, "fixtures/acme"),
            "--target",
            join(root, "fixtures/acme.target.json"),
            "--out",
            join(scratch, `out-${label}`),
            "--result-file",
            join(scratch, `${label}.result.json`),
          ],
          { cwd: stage, env, stdout: "pipe", stderr: "pipe" }
        );
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        const log = stdout + stderr;
        writeFileSync(join(scratch, `${label}.log`), log, { mode: 0o600 });
        results.push({
          label,
          exitCode,
          durationMs: performance.now() - started,
        });
        writeFileSync(
          join(scratch, "report.json"),
          JSON.stringify({ scratch, results }, null, 2),
          { mode: 0o600 }
        );
        if (label === "corrected") {
          expect(exitCode).toBe(0);
          const result = JSON.parse(
            readFileSync(join(scratch, `${label}.result.json`), "utf8")
          );
          expect(result.ok).toBe(true);
          expect(result.fileCount).toBeGreaterThan(0);
          expect(
            existsSync(join(scratch, `out-${label}/blog/index.html`))
          ).toBe(true);
        } else {
          expect(exitCode).not.toBe(0);
          expect(log).toContain("utils/public-assets");
        }
      } finally {
        if (label !== "corrected") {
          renameSync(moved, missing);
        }
      }
    }
  },
  180_000
);
