import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

test("standalone demo artifact honors PORT, proxy redirects, health and SIGTERM", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "notra-demo-production-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(new URL("../.output", import.meta.url), join(directory, ".output"), {
    recursive: true,
  });

  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address();
  await new Promise((resolve) => reservation.close(resolve));

  let logs = "";
  const child = spawn(
    process.execPath,
    [join(directory, ".output/server/index.mjs")],
    {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(port),
        NOTRA_DEMO_MODE: "true",
        UNKEY_DEPLOYMENT_ID: "deployment_test",
        UNKEY_GIT_COMMIT_SHA: "test-commit",
        WORKFLOW_LOCAL_DATA_DIR: join(directory, "workflow-data"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  child.stdout.on("data", (data) => {
    logs += data;
  });
  child.stderr.on("data", (data) => {
    logs += data;
  });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    const exited = once(child, "exit", { signal: AbortSignal.timeout(5000) });
    child.kill("SIGTERM");
    try {
      await exited;
    } catch (error) {
      child.kill("SIGKILL");
      throw error;
    }
  });

  const base = `http://127.0.0.1:${port}`;
  let health;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    health = await fetch(`${base}/api/healthcheck`, {
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    if (health?.ok) {
      break;
    }
    assert.equal(child.exitCode, null, logs);
    await delay(100);
  }
  assert.ok(health?.ok, logs);
  assert.equal((await health.json()).commitSha, "test-commit");
  const response = await fetch(base, {
    redirect: "manual",
    headers: {
      "x-forwarded-host": "demo.usenotra.com",
      "x-forwarded-proto": "https",
    },
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 307, logs);
  assert.equal(response.headers.get("location"), "/api/demo/enter");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
});
