import { dlopen, ptr } from "bun:ffi";
import { execFileSync } from "node:child_process";
import { readlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { setTimeout } from "node:timers/promises";

import { CHROMIUM_EXECUTABLE_NAMES } from "../constants/processes";

export function signalGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
      throw error;
    }
  }
}

export function groupExists(pid: number) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      return true;
    }
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

export function isOwnedBrowserProcess(
  command: string,
  args: string,
  temp: string
) {
  const profileArgument = `--user-data-dir=${join(temp, "browser")}`;
  return (
    CHROMIUM_EXECUTABLE_NAMES.has(basename(command.trim())) &&
    new RegExp(`(?:^|\\s)${RegExp.escape(profileArgument)}(?=\\s|$)`).test(args)
  );
}

function executablePath(pid: number) {
  if (process.platform === "linux") {
    return readlinkSync(`/proc/${pid}/exe`);
  }
  if (process.platform !== "darwin") {
    throw new Error("Process ownership verification requires macOS or Linux");
  }
  const library = dlopen("/usr/lib/libproc.dylib", {
    proc_pidpath: { args: ["i32", "ptr", "u32"], returns: "i32" },
  });
  try {
    const buffer = new Uint8Array(4096);
    const size = library.symbols.proc_pidpath(pid, ptr(buffer), buffer.length);
    if (size <= 0) {
      throw new Error(`Cannot verify executable for process ${pid}`);
    }
    return new TextDecoder().decode(buffer.subarray(0, buffer.indexOf(0)));
  } finally {
    library.close();
  }
}

function isZombie(pid: number) {
  try {
    return execFileSync("ps", ["-o", "stat=", "-p", String(pid)], {
      encoding: "utf8",
    })
      .trim()
      .startsWith("Z");
  } catch {
    return true;
  }
}

export function scopedProcesses(temp: string) {
  const selected: number[] = [];
  for (const line of execFileSync("ps", ["-axo", "pid=,args="], {
    encoding: "utf8",
  }).split("\n")) {
    if (!line.includes(`--user-data-dir=${join(temp, "browser")}`)) {
      continue;
    }
    const pid = Number(line.trim().split(/\s+/, 1)[0]);
    if (pid === process.pid) {
      continue;
    }
    let command: string;
    try {
      command = executablePath(pid);
    } catch {
      try {
        process.kill(pid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") {
          continue;
        }
      }
      // An exited but unreaped process still answers signal 0, yet has no
      // executable to read; it is not a surviving browser.
      if (isZombie(pid)) {
        continue;
      }
      throw new Error(
        `Cannot verify executable for profile-argument candidate ${pid}`
      );
    }
    if (isOwnedBrowserProcess(command, line, temp)) {
      selected.push(pid);
    }
  }
  return selected;
}

export async function reapProcesses(pid: number, temp: string) {
  const ownGroup = Number(
    execFileSync("ps", ["-o", "pgid=", "-p", String(process.pid)], {
      encoding: "utf8",
    }).trim()
  );
  const groups = new Set([pid]);
  for (const child of scopedProcesses(temp)) {
    try {
      const group = Number(
        execFileSync("ps", ["-o", "pgid=", "-p", String(child)], {
          encoding: "utf8",
        }).trim()
      );
      if (
        group === child &&
        group !== ownGroup &&
        scopedProcesses(temp).includes(child)
      ) {
        groups.add(group);
      }
    } catch {
      if (scopedProcesses(temp).includes(child)) {
        throw new Error(
          `Cannot identify process group for surviving scoped process ${child}`
        );
      }
    }
  }
  for (const group of groups) {
    signalGroup(group, "SIGTERM");
  }
  for (const child of scopedProcesses(temp)) {
    if (!groups.has(child)) {
      try {
        process.kill(child, "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
          throw error;
        }
      }
    }
  }
  for (
    let attempt = 0;
    attempt < 20 &&
    ([...groups].some(groupExists) || scopedProcesses(temp).length);
    attempt += 1
  ) {
    if (attempt === 10) {
      for (const group of groups) {
        signalGroup(group, "SIGKILL");
      }
      for (const child of scopedProcesses(temp)) {
        try {
          process.kill(child, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
            throw error;
          }
        }
      }
    }
    await setTimeout(100);
  }
  if ([...groups].some(groupExists) || scopedProcesses(temp).length) {
    throw new Error(
      `Processes survived cleanup for group ${pid}: ${scopedProcesses(temp).join(", ")}`
    );
  }
}

export function syntheticEnvironment(temp: string) {
  return {
    PATH: process.env.PATH ?? "",
    HOME: temp,
    TMPDIR: temp,
    LANG: "en_US.UTF-8",
    TZ: "UTC",
    ASTRO_TELEMETRY_DISABLED: "1",
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: `${temp}/bun-cache`,
  };
}
