import { spawn } from "node:child_process";

import type {
  SpawnAsyncOptions,
  SpawnAsyncResult,
} from "@notra/ai/types/spawn-async";

// Tests run child processes with this instead of spawnSync: on Bun 1.4.0 a
// garbage collection during spawnSync's wait can make it miss the child's
// exit, which hangs `bun test --isolate` for good (oven-sh/bun#47257).
export async function spawnAsync(
  command: string,
  args: string[],
  { cwd, env, input, timeoutMs }: SpawnAsyncOptions
): Promise<SpawnAsyncResult> {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: "pipe",
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdin.end(input);
  const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
  const status = await new Promise<number | null>((resolve) => {
    child.once("close", (code) => resolve(code));
    child.once("error", (error) => {
      stderr += error.message;
      resolve(null);
    });
  });
  clearTimeout(timer);
  return { status, stdout, stderr };
}
