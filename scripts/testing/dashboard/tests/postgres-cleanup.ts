import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const environment = {
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  SITES_TEST_ENABLED: "true",
};
const run = (args: string[]) =>
  spawnSync(
    process.execPath,
    ["--no-env-file", "scripts/testing/dashboard/postgres.ts", ...args],
    { cwd: root, env: environment, encoding: "utf8", timeout: 90_000 }
  );
const started = run(["up"]);
assert.equal(started.status, 0, started.stderr);
const database = JSON.parse(started.stdout);
assert.equal(typeof database.container, "string");
const port = new URL(database.databaseUrl).port;
assert.ok(port);
try {
  const list = () => {
    const result = spawnSync(
      "docker",
      [
        "ps",
        "-a",
        "--filter",
        "label=notra.dashboard-e2e=isolated-test",
        "--format",
        "{{.Names}}",
      ],
      { env: environment, encoding: "utf8", timeout: 10_000 }
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.split("\n").filter(Boolean).sort();
  };
  const before = list();
  assert.ok(before.includes(database.container));
  const duplicate = run(["up", port]);
  assert.notEqual(duplicate.status, 0);
  assert.deepEqual(list(), before);
  const active = spawnSync(
    "docker",
    ["inspect", "--format", "{{.State.Running}}", database.container],
    { env: environment, encoding: "utf8", timeout: 10_000 }
  );
  assert.equal(active.status, 0, active.stderr);
  assert.equal(active.stdout.trim(), "true");
  console.log(
    "Failed allocation cleaned; the existing owned database stayed running"
  );
} finally {
  const stopped = run(["down", database.container]);
  assert.equal(stopped.status, 0, stopped.stderr);
  const absent = spawnSync("docker", ["inspect", database.container], {
    env: environment,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.notEqual(absent.status, 0);
  assert.match(absent.stderr, /no such (?:object|container)/i);
}
