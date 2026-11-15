import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const WORKER_ENV = "NOTRA_ISOLATED_TEST_WORKER";

export const isIsolatedTestWorker = (fileUrl: string) =>
  process.env[WORKER_ENV] === fileUrl;

export function testInIsolatedProcess(name: string, fileUrl: string) {
  test(
    name,
    () => {
      const result = spawnSync(
        process.execPath,
        ["test", "--isolate", fileURLToPath(fileUrl)],
        { env: { ...process.env, [WORKER_ENV]: fileUrl }, timeout: 30_000 }
      );
      expect(result.status, result.stderr?.toString()).toBe(0);
    },
    35_000
  );
}
