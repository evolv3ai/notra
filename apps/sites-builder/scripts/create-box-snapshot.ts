import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { EphemeralBox } from "@upstash/box";

import { WORKDIR } from "./constants/box-snapshot";
import { stageBoxToolchain } from "./utils/stage-box-toolchain";

const { values } = parseArgs({
  options: {
    "write-env": { type: "string" },
    // Release automation: skip the Box when this version is already live and
    // report { version, snapshotId } as JSON instead of parsing stdout.
    "skip-version": { type: "string" },
    "result-file": { type: "string" },
    // E2E runs name their snapshot apart from release snapshots.
    "name-prefix": { type: "string", default: "notra-sites-toolchain" },
  },
});

function writeResult(version: string, snapshotId: string | null) {
  if (values["result-file"]) {
    writeFileSync(
      resolve(values["result-file"]),
      `${JSON.stringify({ version, snapshotId })}\n`
    );
  }
}

let work: string | undefined;
let box: EphemeralBox | undefined;
// A cancelled release or E2E run sends SIGTERM; delete the Box instead of
// leaving it to its TTL.
async function abort() {
  try {
    await box?.delete();
  } finally {
    if (work) {
      rmSync(work, { recursive: true, force: true });
    }
    process.exit(130);
  }
}
process.once("SIGINT", abort);
process.once("SIGTERM", abort);
try {
  work = mkdtempSync(join(tmpdir(), "notra-sites-toolchain-"));
  const stage = join(work, "toolchain");
  const version = await stageBoxToolchain(stage);
  if (version === values["skip-version"]) {
    console.log(`toolchain ${version} unchanged, keeping the current snapshot`);
    writeResult(version, null);
    rmSync(work, { recursive: true, force: true });
    process.exit(0);
  }
  const archive = join(work, "toolchain.tgz");
  execFileSync("tar", ["--no-xattrs", "-czf", archive, "-C", stage, "."], {
    env: { PATH: process.env.PATH, COPYFILE_DISABLE: "1" },
  });
  console.log(`toolchain ${version}`);
  const name = `${values["name-prefix"]}-${version}`;
  box = await EphemeralBox.create({
    name,
    runtime: "node",
    size: "medium",
    ttl: 600,
    env: {},
    networkPolicy: { mode: "allow-all" },
  });
  const audit = await box.exec.command(
    "node -e 'if(Object.keys(process.env).some(k=>/SECRET|TOKEN|API_KEY|DATABASE_URL|ACCESS_KEY|PASSWORD/i.test(k)))process.exit(1)' "
  );
  if (audit.exitCode !== 0) {
    throw new Error(
      "Refusing to snapshot secret-like inherited Box environment variables"
    );
  }
  await box.files.upload([
    { path: archive, destination: `${WORKDIR}/toolchain.tgz` },
  ]);
  await box.exec.command(
    [
      `cd ${WORKDIR}`,
      "rm -rf toolchain && mkdir toolchain",
      "tar xzf toolchain.tgz -C toolchain && rm toolchain.tgz",
      "cd toolchain",
      `env -i PATH="$PATH" HOME="${WORKDIR}" ASTRO_TELEMETRY_DISABLED=1 npm install --omit=dev --no-audit --no-fund --loglevel=error > npm.log 2>&1`,
    ].join(" && ")
  );
  const installedVersion = (
    await box.files.read(`${WORKDIR}/toolchain/VERSION`)
  ).trim();
  const astro = await box.files
    .read(`${WORKDIR}/toolchain/node_modules/astro/package.json`)
    .catch(() => null);
  if (installedVersion !== version || !astro) {
    const log = await box.files
      .read(`${WORKDIR}/toolchain/npm.log`)
      .catch(() => "");
    throw new Error(`Toolchain install failed:\n${log}`);
  }
  const snapshot = await box.snapshot({ name });
  console.log(`SITES_BUILDER_SNAPSHOT_ID=${snapshot.id}`);
  writeResult(version, snapshot.id);
  if (values["write-env"]) {
    const envPath = resolve(values["write-env"]);
    const text = readFileSync(envPath, "utf8");
    const line = `SITES_BUILDER_SNAPSHOT_ID=${snapshot.id}`;
    writeFileSync(
      envPath,
      /^SITES_BUILDER_SNAPSHOT_ID=.*$/m.test(text)
        ? text.replace(/^SITES_BUILDER_SNAPSHOT_ID=.*$/m, line)
        : `${text.trimEnd()}\n${line}\n`
    );
    console.log(`updated ${envPath}`);
  }
} finally {
  try {
    await box?.delete();
  } finally {
    if (work) {
      rmSync(work, { recursive: true, force: true });
    }
  }
}
