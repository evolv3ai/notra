import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

test("user workspace deletion guards and teardown ordering", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--no-env-file",
      "test",
      "./tests/fixtures/user-organization-teardown.fixture.ts",
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      env: { PATH: process.env.PATH, DATABASE_URL: "" },
      timeout: 90_000,
    }
  );
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 95_000);
