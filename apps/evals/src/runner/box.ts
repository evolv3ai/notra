import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { EphemeralBox } from "@upstash/box";

import {
  BOX_ALLOWED_DOMAINS,
  BOX_APP_DIR,
  BOX_ARGS_PATH,
  BOX_BUNDLE_PATH,
  BOX_EXIT_PATH,
  BOX_LOG_PATH,
  BOX_NAME_PREFIX,
  BOX_POLL_INTERVAL_MS,
  BOX_REQUEST_TIMEOUT_MS,
  BOX_RUNS_DIR,
  BOX_TTL_SECONDS,
} from "../constants/box";
import { APP_DIR, RUNS_DIR } from "../constants/paths";
import type { HeadlessArgs } from "../headless";
import { getSuite, SUITES } from "../suites/registry";

/** One self-contained node bundle: no install, so the box needs no registry. */
function bundle(dir: string) {
  const outfile = join(dir, "evals.mjs");
  execFileSync(
    process.execPath,
    [
      "build",
      join(APP_DIR, "src/box-entry.ts"),
      "--target=node",
      `--outfile=${outfile}`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  return outfile;
}

/**
 * Runs a suite headless inside an ephemeral Upstash Box that can reach only
 * the AI Gateway, then copies the run JSON into .runs. The box is deleted in
 * every case; its TTL is the backstop if the delete itself fails.
 */
export async function runInBox(args: HeadlessArgs): Promise<number> {
  if (!getSuite(args.suiteId)) {
    console.error(
      `Unknown suite "${args.suiteId}". Available: ${SUITES.map((item) => item.id).join(", ")}`
    );
    return 1;
  }
  const boxApiKey = process.env.UPSTASH_BOX_API_KEY?.trim();
  if (!boxApiKey) {
    console.error(
      "UPSTASH_BOX_API_KEY is missing. Add it to the repo root .env or the environment to run evals in a box."
    );
    return 1;
  }
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!(args.demo || gatewayKey)) {
    console.error(
      "AI_GATEWAY_API_KEY is missing. Add it to the repo root .env or use --demo."
    );
    return 1;
  }

  const stage = mkdtempSync(join(tmpdir(), "notra-evals-box-"));
  let box: EphemeralBox | undefined;
  const cancelled = new AbortController();
  const abort = () => {
    cancelled.abort();
    console.log("\nCancelling, deleting the box…");
  };
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);

  try {
    console.log("Bundling the eval harness…");
    const bundlePath = bundle(stage);
    const argsPath = join(stage, "args.json");
    writeFileSync(argsPath, JSON.stringify(args));

    box = await EphemeralBox.create({
      apiKey: boxApiKey,
      baseUrl: process.env.UPSTASH_BOX_BASE_URL?.trim() || undefined,
      name: `${BOX_NAME_PREFIX}${args.suiteId}-${Date.now().toString(36)}`,
      runtime: "node",
      size: "small",
      ttl: BOX_TTL_SECONDS,
      timeout: BOX_REQUEST_TIMEOUT_MS,
      // Demo runs make no calls at all; live runs get the one key they need.
      env: args.demo || !gatewayKey ? {} : { AI_GATEWAY_API_KEY: gatewayKey },
      networkPolicy: args.demo
        ? { mode: "deny-all" }
        : { mode: "custom", allowedDomains: BOX_ALLOWED_DOMAINS },
    });
    console.log(`Box ${box.id} created`);

    await box.exec.command(`mkdir -p ${BOX_APP_DIR}/dist/box ${BOX_RUNS_DIR}`);
    await box.files.upload([
      { path: bundlePath, destination: BOX_BUNDLE_PATH },
      { path: argsPath, destination: BOX_ARGS_PATH },
    ]);
    await box.exec.command(
      `cd ${BOX_APP_DIR} && nohup sh -c 'node ${BOX_BUNDLE_PATH} ${BOX_ARGS_PATH} > ${BOX_LOG_PATH} 2>&1; echo $? > ${BOX_EXIT_PATH}' > /dev/null 2>&1 &`
    );

    let printed = 0;
    let exitCode: number | null = null;
    while (!cancelled.signal.aborted && exitCode === null) {
      await sleep(BOX_POLL_INTERVAL_MS);
      const poll = await box.exec.command(
        `cat ${BOX_LOG_PATH} 2>/dev/null; echo "__exit:$(cat ${BOX_EXIT_PATH} 2>/dev/null)"`
      );
      const text = String(poll.result ?? "");
      const marker = text.lastIndexOf("__exit:");
      const code = text.slice(marker + "__exit:".length).trim();
      exitCode = code ? Number(code) : null;
      // Only whole lines, unless the run is over and the rest is final.
      const log = text.slice(0, marker);
      const ready =
        exitCode === null ? log.slice(0, log.lastIndexOf("\n") + 1) : log;
      process.stdout.write(ready.slice(printed));
      printed = Math.max(printed, ready.length);
    }
    if (cancelled.signal.aborted) {
      return 130;
    }

    const entries = await box.files.list(BOX_RUNS_DIR);
    await mkdir(RUNS_DIR, { recursive: true });
    const runs = entries.filter((row) => row.name.endsWith(".json"));
    const files = box.files;
    const contents = await Promise.all(
      runs.map((entry) => files.read(`${BOX_RUNS_DIR}/${entry.name}`))
    );
    runs.forEach((entry, index) => {
      writeFileSync(join(RUNS_DIR, entry.name), contents[index] ?? "");
      console.log(`Copied the run to apps/evals/.runs/${entry.name}`);
    });
    return exitCode ?? 1;
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
    if (box) {
      await box.delete().then(
        () => console.log(`Box ${box?.id} deleted`),
        (error: unknown) =>
          console.error(
            `Could not delete box ${box?.id}, it expires after ${BOX_TTL_SECONDS / 3600} h: ${String(error)}`
          )
      );
    }
    rmSync(stage, { recursive: true, force: true });
  }
}
