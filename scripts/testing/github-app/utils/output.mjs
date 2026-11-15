import { execFileSync } from "node:child_process";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export async function prepareOutput(path) {
  const target = resolve(path);
  if (basename(target) === ".env") {
    throw new Error("Use a dedicated new GitHub App env file, not .env");
  }
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const canonical = join(await realpath(dirname(target)), basename(target));
  try {
    await lstat(canonical);
    throw new Error("Output already exists; choose a new untracked file");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  let tracked = false;
  try {
    tracked =
      execFileSync(
        "git",
        ["-C", dirname(canonical), "ls-files", "--", basename(canonical)],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      ).trim().length > 0;
  } catch (error) {
    if (error.status !== 128) {
      throw new Error("Could not check whether output is tracked");
    }
  }
  if (tracked) {
    throw new Error("Output must be untracked");
  }
  return canonical;
}

export async function writeAppEnv(path, env) {
  const target = await prepareOutput(path);
  const file = await open(target, "wx", 0o600);
  try {
    await file.chmod(0o600);
    const text = Object.entries(env)
      .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
      .join("\n");
    await file.writeFile(`${text}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
}
