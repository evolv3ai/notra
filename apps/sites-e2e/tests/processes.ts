import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright";

import {
  groupExists,
  isOwnedBrowserProcess,
  reapProcesses,
  scopedProcesses,
  signalGroup,
  syntheticEnvironment,
} from "../src/utils/processes";

const temp = await mkdtemp(
  join(await realpath(tmpdir()), "notra-sites-e2e-processes-")
);
const profile = `--user-data-dir=${join(temp, "browser")}`;
assert.equal(
  isOwnedBrowserProcess(
    "/usr/bin/editor",
    `editor ${temp}/artifact ${profile}`,
    temp
  ),
  false
);
assert.equal(
  isOwnedBrowserProcess("/usr/bin/chromium", `chromium ${temp}/artifact`, temp),
  false
);
assert.equal(
  isOwnedBrowserProcess("/usr/bin/chromium", `chromium ${profile}-other`, temp),
  false
);
assert.equal(
  isOwnedBrowserProcess(
    "/usr/bin/chromium",
    `chromium --example=${profile}`,
    temp
  ),
  false
);
assert.equal(
  isOwnedBrowserProcess("/usr/bin/chromium", `chromium ${profile}`, temp),
  true
);
assert.equal(
  isOwnedBrowserProcess(
    "/Applications/Helium.app/Contents/MacOS/Helium",
    `Helium ${profile} --headless`,
    temp
  ),
  true
);
const unrelated = spawn(
  process.execPath,
  ["--no-env-file", "-e", "setInterval(() => {}, 1000)", temp, profile],
  { detached: true, env: syntheticEnvironment(temp), stdio: "ignore" }
);
const worker = spawn(
  process.execPath,
  ["--no-env-file", "-e", "setInterval(() => {}, 1000)"],
  { detached: true, env: syntheticEnvironment(temp), stdio: "ignore" }
);
assert.ok(unrelated.pid);
assert.ok(worker.pid);
let browser:
  | Awaited<ReturnType<typeof chromium.launchPersistentContext>>
  | undefined;
try {
  browser = await chromium.launchPersistentContext(join(temp, "browser"), {
    headless: true,
    executablePath: chromium.executablePath(),
    env: syntheticEnvironment(temp),
  });
  const roots = scopedProcesses(temp);
  assert.ok(roots.length > 0, "Actual isolated Chromium root must be selected");
  assert.equal(
    roots.includes(unrelated.pid),
    false,
    "Unrelated command mentioning the exact profile must not be selected"
  );
  await reapProcesses(worker.pid, temp);
  assert.equal(groupExists(worker.pid), false);
  assert.deepEqual(scopedProcesses(temp), []);
  process.kill(unrelated.pid, 0);
  assert.equal(
    groupExists(unrelated.pid),
    true,
    "Unrelated process group must survive orphan recovery"
  );
  console.log(
    "Owned orphan Chromium recovered; unrelated process mentioning temp/profile survived"
  );
} finally {
  try {
    await browser?.browser()?.close();
  } finally {
    signalGroup(unrelated.pid, "SIGTERM");
    signalGroup(worker.pid, "SIGTERM");
    await rm(temp, { recursive: true, force: true });
  }
}
