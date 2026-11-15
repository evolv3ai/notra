import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const script = join(import.meta.dirname, "../bootstrap-github-cli.ts");
for (const [env, repository, expected] of [
  [{}, "janburzinski/notra-sites-e2e-synthetic", "SITES_TEST_ENABLED=true"],
  [
    {
      SITES_TEST_ENABLED: "true",
      SITES_TEST_DATABASE_URL:
        "postgresql://synthetic@db.example.test/production",
    },
    "janburzinski/notra-sites-e2e-synthetic",
    "Only explicit-port loopback",
  ],
  [
    {
      SITES_TEST_ENABLED: "true",
      SITES_TEST_DATABASE_URL:
        "postgresql://synthetic@127.0.0.1:1/notra_server_audit",
    },
    "usenotra/notra",
    "disposable Sites E2E repository",
  ],
] as const) {
  const result = spawnSync(
    process.execPath,
    ["--no-env-file", script, repository],
    { env: { ...env, PATH: "" }, encoding: "utf8", timeout: 5000 }
  );
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(expected));
}
console.log(
  "GitHub bootstrap refuses disabled tests, nonisolated databases and nonfixture repositories before CLI or database access"
);
