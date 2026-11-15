import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { groupExists, scopedProcesses } from "../src/utils/processes";
import { fixtureToolchain } from "../src/utils/toolchain";

const runner = resolve(import.meta.dir, "../src/run.ts");
for (const [name, flags, signal, marker, expectedCode, expectedStatus] of [
  ["pass", [], null, null, 0, "passed"],
  ["assertion failure", ["--failure-probe"], null, null, 1, "failed"],
  [
    "SIGINT with browser/server active",
    ["--hold-probe"],
    "SIGINT",
    "E2E_READY",
    130,
    "cancelled",
  ],
  [
    "SIGTERM during compilation",
    [],
    "SIGTERM",
    "Building static entrypoints",
    130,
    "cancelled",
  ],
  [
    "deadline during compilation",
    ["--timeout", "0.5"],
    null,
    null,
    124,
    "timed-out",
  ],
] as const) {
  const child = spawn(
    process.execPath,
    ["--no-env-file", runner, "--repetitions", "1", ...flags],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? "",
      },
    }
  );
  let stdout = "";
  let stderr = "";
  let signalled = false;
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    if (signal && marker && stderr.includes(marker) && !signalled) {
      signalled = true;
      child.kill(signal);
    }
  });
  const watchdog = setTimeout(() => child.kill("SIGTERM"), 120_000);
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code));
  });
  clearTimeout(watchdog);
  assert.equal(code, expectedCode, `${name}\n${stderr}\n${stdout}`);
  if (signal) {
    assert.ok(signalled, `Cancellation marker not reached: ${name}`);
  }
  if (name === "assertion failure") {
    assert.match(stderr, /Deliberate E2E assertion failure/);
  }
  const report = JSON.parse(stdout);
  assert.equal(report.status, expectedStatus);
  assert.equal(report.cleanup.passed, true, JSON.stringify(report.cleanup));
  const start = /E2E_START (\{[^\n]+\})/.exec(stderr);
  assert.ok(start);
  const { pid, temp } = JSON.parse(start[1]);
  assert.equal(existsSync(temp), false);
  assert.equal(
    existsSync(fixtureToolchain(resolve(import.meta.dir, "../../.."), temp)),
    false,
    `${name} left its builder toolchain behind`
  );
  assert.equal(groupExists(pid), false);
  assert.deepEqual(scopedProcesses(temp), []);
  process.stdout.write(
    `${JSON.stringify({ name, exitCode: code, status: report.status, cleanup: report.cleanup })}\n`
  );
}
