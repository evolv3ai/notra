import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

test("demo admission requires a verified human before allocating capacity", () => {
  const result = spawnSync(
    process.execPath,
    ["test", "./tests/fixtures/demo-admission.fixture.ts"],
    {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      timeout: 15_000,
    }
  );
  expect(result.status, result.stderr).toBe(0);
});
