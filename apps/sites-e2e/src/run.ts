import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  access,
  copyFile,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

import {
  reapProcesses,
  signalGroup,
  syntheticEnvironment,
} from "./utils/processes";
import { fixtureToolchain } from "./utils/toolchain";

const { values } = parseArgs({
  options: {
    repetitions: { type: "string", default: "3" },
    timeout: { type: "string", default: "300" },
    executable: { type: "string" },
    report: { type: "string" },
    screenshot: { type: "string" },
    "failure-probe": { type: "boolean", default: false },
    "hold-probe": { type: "boolean", default: false },
    // live: load the vendors' real analytics scripts (needs internet).
    "vendor-scripts": { type: "string", default: "emulated" },
  },
});
const repetitions = Number(values.repetitions);
const timeout = Number(values.timeout);
assert.ok(
  Number.isInteger(repetitions) && repetitions > 0 && repetitions <= 100,
  "repetitions must be 1..100"
);
assert.ok(
  Number.isFinite(timeout) && timeout > 0,
  "timeout must be positive seconds"
);
assert.ok(!(values["failure-probe"] && values["hold-probe"]));
assert.ok(
  ["emulated", "live"].includes(values["vendor-scripts"] ?? ""),
  "vendor-scripts must be emulated or live"
);
const executable = values.executable ?? chromium.executablePath();
if (executable) {
  await access(executable);
}
const temp = await realpath(await mkdtemp(join(tmpdir(), "notra-sites-e2e-")));
const root = resolve(import.meta.dir, "../../..");
const toolchain = fixtureToolchain(root, temp);
let mode = "test";
if (values["failure-probe"]) {
  mode = "fail";
}
if (values["hold-probe"]) {
  mode = "hold";
}
const child = spawn(
  process.execPath,
  [
    "--no-env-file",
    join(import.meta.dir, "worker.ts"),
    temp,
    String(repetitions),
    executable,
    mode,
    values["vendor-scripts"] ?? "emulated",
  ],
  {
    cwd: root,
    env: syntheticEnvironment(temp),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  }
);
assert.ok(child.pid);
const pid = child.pid;
process.stderr.write(`E2E_START ${JSON.stringify({ pid, temp })}\n`);
child.stdout.on("data", (chunk) => process.stderr.write(chunk));
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
let interrupted: NodeJS.Signals | undefined;
let timedOut = false;
let forced: ReturnType<typeof setTimeout> | undefined;
const stop = (signal: NodeJS.Signals) => {
  if (interrupted || timedOut) {
    return;
  }
  interrupted = signal;
  signalGroup(pid, "SIGTERM");
  forced = setTimeout(() => signalGroup(pid, "SIGKILL"), 10_000);
};
const onInterrupt = () => stop("SIGINT");
const onTerminate = () => stop("SIGTERM");
process.on("SIGINT", onInterrupt);
process.on("SIGTERM", onTerminate);
const deadline = setTimeout(() => {
  timedOut = true;
  signalGroup(pid, "SIGTERM");
  forced = setTimeout(() => signalGroup(pid, "SIGKILL"), 10_000);
}, timeout * 1000);
let report: Record<string, unknown> = {};
const cleanupErrors: string[] = [];
let exitCode: number;
try {
  const code = await new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
  exitCode = code;
  if (timedOut) {
    exitCode = 124;
  }
  if (interrupted) {
    exitCode = 130;
  }
  if (existsSync(join(temp, "report.json"))) {
    report = JSON.parse(await readFile(join(temp, "report.json"), "utf8"));
  }
  if (exitCode === 0) {
    assert.equal(
      report.status,
      "passed",
      "A successful worker must emit a completed assertion report"
    );
    assert.ok(
      Array.isArray(report.measurements) && report.measurements.length > 0
    );
  }
  report.status = exitCode === 0 ? "passed" : "failed";
  if (timedOut) {
    report.status = "timed-out";
  }
  if (interrupted) {
    report.status = "cancelled";
  }
  report.exitCode = exitCode;
  if (exitCode === 0 && values.screenshot) {
    await copyFile(join(temp, "live.png"), resolve(values.screenshot));
  }
  // A failed run keeps what the browser showed, next to the screenshot.
  if (
    exitCode !== 0 &&
    values.screenshot &&
    existsSync(join(temp, "failure.png"))
  ) {
    await copyFile(
      join(temp, "failure.png"),
      join(dirname(resolve(values.screenshot)), "failure.png")
    );
  }
} catch (error) {
  exitCode = 1;
  report.status = "failed";
  report.error = String(error);
} finally {
  clearTimeout(deadline);
  if (forced) {
    clearTimeout(forced);
  }
  try {
    await reapProcesses(pid, temp);
  } catch (error) {
    cleanupErrors.push(String(error));
  }
  try {
    if (existsSync(join(temp, "worker-cleanup.json"))) {
      const workerCleanup = JSON.parse(
        await readFile(join(temp, "worker-cleanup.json"), "utf8")
      );
      if (!workerCleanup.passed) {
        cleanupErrors.push(...workerCleanup.errors);
      }
    }
  } catch (error) {
    cleanupErrors.push(String(error));
  }
  try {
    if (existsSync(join(temp, "server.json"))) {
      const { port } = JSON.parse(
        await readFile(join(temp, "server.json"), "utf8")
      );
      const closed = await new Promise<boolean>((resolveClosed) => {
        const socket = createConnection({ host: "127.0.0.1", port });
        socket.once("connect", () => {
          socket.destroy();
          resolveClosed(false);
        });
        socket.once("error", (error) => {
          socket.destroy();
          resolveClosed(
            (error as NodeJS.ErrnoException).code === "ECONNREFUSED"
          );
        });
        socket.setTimeout(2000, () => {
          socket.destroy();
          resolveClosed(false);
        });
      });
      if (!closed) {
        cleanupErrors.push(
          `Server port ${port} remained open or could not be verified`
        );
      }
    }
  } catch (error) {
    cleanupErrors.push(String(error));
  }
  try {
    // An interrupted worker exits before its compiler cleans up.
    await rm(toolchain, { recursive: true, force: true });
    await rm(temp, { recursive: true, force: true });
    assert.equal(existsSync(toolchain), false);
    assert.equal(existsSync(temp), false);
  } catch (error) {
    cleanupErrors.push(String(error));
  }
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
}
report.cleanup = {
  passed: cleanupErrors.length === 0,
  errors: cleanupErrors,
  processGroup: pid,
  tempRemoved: !(existsSync(temp) || existsSync(toolchain)),
  checks: [
    "worker/compiler process group exited",
    "no browser/profile-scoped processes survived",
    "HTTP port refuses connections",
    "temporary build outputs/toolchain/profile removed",
  ],
};
if (cleanupErrors.length) {
  exitCode = 1;
  report.status = "cleanup-failed";
}
report.exitCode = exitCode;
const json = `${JSON.stringify(report, null, 2)}\n`;
try {
  if (values.report) {
    await writeFile(resolve(values.report), json);
  }
  process.stdout.write(json);
} catch (error) {
  console.error(error);
  exitCode = 1;
}
process.exitCode = exitCode;
