import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  Box,
  EphemeralBox,
} from "../../../apps/sites-builder/node_modules/@upstash/box/dist/index.js";
import { WORKDIR } from "../../../apps/sites-builder/scripts/constants/box-snapshot";
import { stageBoxToolchain } from "../../../apps/sites-builder/scripts/utils/stage-box-toolchain";
import {
  SITE_BUILD_LIMITS,
  SITE_R2_KEYS,
} from "../../../packages/sites-core/src/constants/sites";
import { siteBuildRequestSchema } from "../../../packages/sites-core/src/schemas/build";
import {
  siteBuildTargetSchema,
  siteHostRecordSchema,
  siteManifestSchema,
  siteServingStateSchema,
} from "../../../packages/sites-core/src/schemas/deployment";
import type {
  CloudLedger,
  OwnedResource,
  PreparedBucketLedger,
} from "./types/resources";
import {
  requireCloudflareTestAccountId,
  requireCloudflareTestProfile,
} from "./utils/cloudflare-account";
import { ownedBoxFetch } from "./utils/owned-box-fetch";
import {
  assertOwned,
  cleanupOwned,
  matchOwnedProviderResources,
  requireSnapshotId,
  saveLedger,
} from "./utils/ownership";
import {
  assertOwnedObjectKeys,
  requirePreparedBucket,
} from "./utils/prepared-bucket";
import { readCloudPreviewSecret, redactCloudOutput } from "./utils/redaction";

const { values } = parseArgs({
  options: {
    recover: { type: "string" },
    "delete-snapshot": { type: "boolean" },
    "bucket-ledger": { type: "string" },
    repeats: { type: "string", default: "1" },
  },
});
const recoveryDirectory = values.recover ? resolve(values.recover) : null;
const recoveryConfig = recoveryDirectory
  ? JSON.parse(readFileSync(join(recoveryDirectory, "wrangler.json"), "utf8"))
  : null;
const recoveryLedger: CloudLedger | null = recoveryDirectory
  ? JSON.parse(readFileSync(join(recoveryDirectory, "ledger.json"), "utf8"))
  : null;
const accountId = requireCloudflareTestAccountId(
  recoveryDirectory
    ? recoveryConfig.account_id
    : process.env.SITES_E2E_CLOUDFLARE_ACCOUNT_ID
);
const wranglerProfile = requireCloudflareTestProfile(
  recoveryLedger?.wranglerProfile ?? process.env.SITES_E2E_WRANGLER_PROFILE
);
if (
  recoveryLedger?.cloudflareAccountId &&
  recoveryLedger.cloudflareAccountId !== accountId
) {
  throw new Error("Recovery ledger and Wrangler config account IDs disagree");
}
const credentials = {
  SITES_R2_ACCOUNT_ID: accountId,
  SITES_R2_ACCESS_KEY_ID: process.env.SITES_E2E_R2_ACCESS_KEY_ID ?? "",
  SITES_R2_SECRET_ACCESS_KEY: process.env.SITES_E2E_R2_SECRET_ACCESS_KEY ?? "",
  UPSTASH_BOX_API_KEY: process.env.UPSTASH_BOX_API_KEY ?? "",
};
const cliEnv = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "USER", "SHELL"].flatMap((name) =>
    process.env[name] ? [[name, process.env[name]]] : []
  )
);
for (const name of Object.keys(process.env)) {
  delete process.env[name];
}
Object.assign(process.env, cliEnv, credentials);
if (!credentials.UPSTASH_BOX_API_KEY) {
  throw new Error("Selected Box credentials are required");
}
if (
  !values.recover &&
  (!credentials.SITES_R2_ACCESS_KEY_ID ||
    !credentials.SITES_R2_SECRET_ACCESS_KEY)
) {
  throw new Error("Scoped SITES_E2E_R2 credentials are required for new runs");
}
const root = resolve(import.meta.dirname, "../../..");
const runId = recoveryLedger
  ? recoveryLedger.runId
  : `notra-sites-e2e-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const directory =
  recoveryDirectory ?? join(process.env.HOME ?? "", ".capy/work", runId);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const ledgerPath = join(directory, "ledger.json");
const ledger: CloudLedger = recoveryLedger ?? {
  version: 1,
  runId,
  cloudflareAccountId: accountId,
  wranglerProfile,
  resources: [],
  objectKeys: [],
};
if (values["bucket-ledger"] && !recoveryDirectory) {
  const prepared: PreparedBucketLedger = JSON.parse(
    readFileSync(resolve(values["bucket-ledger"]), "utf8")
  );
  ledger.preparedBucket = requirePreparedBucket(
    prepared,
    accountId,
    wranglerProfile
  );
}
if (ledger.preparedBucket) {
  ledger.preparedBucket = requirePreparedBucket(
    {
      accountId: ledger.cloudflareAccountId ?? accountId,
      wranglerProfile: ledger.wranglerProfile ?? wranglerProfile,
      bucket: ledger.preparedBucket.name,
      created: true,
      providerCreatedAt: ledger.preparedBucket.createdAt,
    },
    accountId,
    wranglerProfile
  );
}
if (
  ledger.preparedBucket &&
  (!credentials.SITES_R2_ACCESS_KEY_ID ||
    !credentials.SITES_R2_SECRET_ACCESS_KEY)
) {
  throw new Error(
    "Scoped SITES_E2E_R2 credentials are required to clean a prepared bucket"
  );
}
ledger.cloudflareAccountId ??= accountId;
ledger.wranglerProfile ??= wranglerProfile;
if (values["delete-snapshot"]) {
  for (const resource of ledger.resources) {
    resource.retained = false;
  }
}
const persist = () => saveLedger(ledgerPath, ledger);
persist();
const bucketName = ledger.preparedBucket?.name ?? `${runId}-bucket`;
if (
  recoveryConfig &&
  ledger.preparedBucket &&
  recoveryConfig.r2_buckets?.find(
    (binding: { binding: string }) => binding.binding === "SITES_BUCKET"
  )?.bucket_name !== bucketName
) {
  throw new Error("Recovery bucket binding and ownership ledger disagree");
}
const workerName = `${runId}-worker`;
const configPath = join(directory, "wrangler.json");
const report: Record<string, unknown> = {
  runId,
  cloudflareAccountId: accountId,
  wranglerProfile,
  scope:
    "isolated Box → R2 → Worker subset; no GitHub/dashboard, custom DNS, or provider billing validation",
  startedAt: new Date().toISOString(),
  durationsMs: {},
  builds: [],
  requests: [],
};
const durations = report.durationsMs as Record<string, number>;
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: credentials.SITES_R2_ACCESS_KEY_ID,
    secretAccessKey: credentials.SITES_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});
const previewSecret = recoveryConfig
  ? readCloudPreviewSecret(recoveryConfig)
  : randomBytes(32).toString("hex");
const secrets = [
  ...Object.values(credentials).filter((value) => value.length > 8),
  previewSecret,
];
const redact = (text: string) => redactCloudOutput(text, secrets);
async function phase<T>(name: string, operation: () => Promise<T>) {
  const start = performance.now();
  try {
    return await operation();
  } finally {
    durations[name] = performance.now() - start;
  }
}
async function cli(args: string[], allowFailure = false) {
  const child = spawn(
    "wrangler",
    ["--profile", wranglerProfile, "--config", configPath, ...args],
    {
      cwd: directory,
      env: {
        ...cliEnv,
        CLOUDFLARE_ACCOUNT_ID: accountId,
        WRANGLER_SEND_METRICS: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const stdout: string[] = [];
  const stderr: string[] = [];
  child.stdout.on("data", (chunk) => stdout.push(String(chunk)));
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
  const output = redact(stdout.join("") + stderr.join(""));
  if (exitCode && !allowFailure) {
    throw new Error(
      `wrangler ${args.slice(0, 3).join(" ")} (${exitCode}): ${output}`
    );
  }
  return { output, stdout: redact(stdout.join("")), exitCode };
}
function own(kind: OwnedResource["kind"], suffix: string = kind) {
  const resource: OwnedResource = { kind, name: `${runId}-${suffix}` };
  ledger.resources.push(resource);
  persist();
  return resource;
}
const originalFetch = globalThis.fetch;
globalThis.fetch = ownedBoxFetch(ledger, persist, originalFetch);
async function absent(resource: OwnedResource) {
  assertOwned(ledger, resource);
  if (resource.kind === "box") {
    const boxes = await Box.list({ apiKey: credentials.UPSTASH_BOX_API_KEY });
    return matchOwnedProviderResources(ledger, resource, boxes).length === 0;
  }
  if (resource.kind === "snapshot") {
    const source = ledger.resources.find(
      (entry) => entry.kind === "box" && entry.name.endsWith("-toolchain")
    );
    if (!source?.id) {
      return !resource.id;
    }
    const response = await originalFetch(
      `https://us-east-1.box.upstash.com/v2/box/${source.id}/snapshots`,
      { headers: { "X-Box-Api-Key": credentials.UPSTASH_BOX_API_KEY ?? "" } }
    );
    if (!response.ok) {
      throw new Error(`Snapshot absence check HTTP ${response.status}`);
    }
    const data = await response.json();
    return (
      matchOwnedProviderResources(ledger, resource, data.snapshots ?? [])
        .length === 0
    );
  }
  if (resource.kind === "bucket") {
    const { output } = await cli(["r2", "bucket", "list"]);
    return !output.includes(resource.name);
  }
  const result = await cli(
    ["versions", "list", "--name", resource.name, "--json"],
    true
  );
  if (!result.exitCode) {
    return false;
  }
  if (/10007|does not exist|not found/i.test(result.output)) {
    return true;
  }
  throw new Error(`Worker absence check failed: ${result.output}`);
}
async function remove(resource: OwnedResource) {
  assertOwned(ledger, resource);
  if (resource.kind === "box") {
    const matches = matchOwnedProviderResources(
      ledger,
      resource,
      await Box.list({ apiKey: credentials.UPSTASH_BOX_API_KEY })
    );
    for (const box of matches) {
      await Box.delete({
        apiKey: credentials.UPSTASH_BOX_API_KEY,
        boxIds: box.id,
      });
    }
  } else if (resource.kind === "snapshot") {
    const source = ledger.resources.find(
      (entry) => entry.kind === "box" && entry.name.endsWith("-toolchain")
    );
    if (!source?.id) {
      throw new Error("Snapshot source Box ID missing");
    }
    const response = await originalFetch(
      `https://us-east-1.box.upstash.com/v2/box/${source.id}/snapshots`,
      { headers: { "X-Box-Api-Key": credentials.UPSTASH_BOX_API_KEY ?? "" } }
    );
    if (!response.ok) {
      throw new Error(`Snapshot recovery HTTP ${response.status}`);
    }
    const data = await response.json();
    const matches = matchOwnedProviderResources(
      ledger,
      resource,
      data.snapshots ?? []
    );
    const snapshot = matches[0];
    if (matches.length !== 1 || !snapshot) {
      throw new Error("Snapshot recovery is ambiguous");
    }
    resource.id = requireSnapshotId(snapshot.id);
    persist();
    await Box.deleteSnapshots({
      apiKey: credentials.UPSTASH_BOX_API_KEY,
      snapshotIds: [requireSnapshotId(resource.id)],
    });
  } else if (resource.kind === "worker") {
    await cli(["delete", resource.name]);
  } else {
    for (const key of ledger.objectKeys) {
      if (!/^(deployments|sites|hosts)\//.test(key) || key.includes("..")) {
        throw new Error("Unsafe ledger object key");
      }
      await cli([
        "r2",
        "object",
        "delete",
        `${resource.name}/${key}`,
        "--remote",
      ]);
    }
    await cli(["r2", "bucket", "delete", resource.name]);
  }
}
async function cleanupRun() {
  const errors: unknown[] = [];
  try {
    await cleanupOwned(ledger, remove, absent, persist);
  } catch (error) {
    errors.push(error);
  }
  if (ledger.preparedBucket) {
    try {
      assertOwnedObjectKeys(ledger);
      const actual = await cli(["r2", "bucket", "info", bucketName, "--json"]);
      const identity = JSON.parse(actual.stdout);
      if (
        identity.name !== bucketName ||
        identity.created !== ledger.preparedBucket.createdAt
      ) {
        throw new Error(
          "Prepared bucket provider identity changed; refusing deletion"
        );
      }
      for (let offset = 0; offset < ledger.objectKeys.length; offset += 1000) {
        const deleted = await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: ledger.objectKeys
                .slice(offset, offset + 1000)
                .map((Key) => ({ Key })),
            },
          })
        );
        if (deleted.Errors?.length) {
          throw new Error("Prepared bucket object deletion failed");
        }
      }
      for (const Prefix of [
        `deployments/${runId}-site/`,
        `sites/${runId}-site/`,
        `hosts/${runId}-worker.`,
      ]) {
        const remaining = await s3.send(
          new ListObjectsV2Command({ Bucket: bucketName, Prefix, MaxKeys: 1 })
        );
        if (remaining.Contents?.length) {
          throw new Error("Owned objects remain in the prepared bucket");
        }
      }
      report.preparedBucketCleanup = {
        bucket: bucketName,
        deletedObjectCount: ledger.objectKeys.length,
        absenceVerified: true,
        bucketPreserved: true,
      };
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    throw new AggregateError(
      errors,
      errors
        .map((error) =>
          error instanceof Error ? error.message : "cleanup failed"
        )
        .join("\n")
    );
  }
}
if (values.recover) {
  try {
    await cleanupRun();
    console.log(
      JSON.stringify({
        directory,
        recovered: true,
        preparedBucketCleanup: report.preparedBucketCleanup,
        remaining: ledger.resources.filter((resource) => !resource.deleted),
      })
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        directory,
        recovered: false,
        error: redact(error instanceof Error ? error.message : String(error)),
      })
    );
    process.exitCode = 1;
  } finally {
    s3.destroy();
  }
  process.exit(process.exitCode ?? 0);
}
writeFileSync(
  configPath,
  JSON.stringify({
    name: workerName,
    account_id: credentials.SITES_R2_ACCOUNT_ID,
    main: join(root, "apps/sites/src/index.ts"),
    compatibility_date: "2026-09-01",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: true,
    routes: [],
    r2_buckets: [{ binding: "SITES_BUCKET", bucket_name: bucketName }],
    vars: {
      HOSTING_DOMAIN: `${runId}.invalid`,
      DASHBOARD_URL: "https://dashboard.invalid",
      TRAFFIC_INGEST_URL: "",
      PREVIEW_SECRET: previewSecret,
    },
    observability: { enabled: false },
  }),
  { mode: 0o600 }
);
let failure: unknown;
try {
  const repeats = Number(values.repeats);
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) {
    throw new Error("repeats must be 1–3");
  }
  await phase("cloudflareAccountPreflight", () =>
    cli(["r2", "bucket", "list"])
  );
  if (ledger.preparedBucket) {
    const actual = await cli(["r2", "bucket", "info", bucketName, "--json"]);
    const info = JSON.parse(actual.stdout);
    if (
      info.name !== bucketName ||
      info.created !== ledger.preparedBucket.createdAt
    ) {
      throw new Error("Prepared bucket provider identity changed");
    }
    report.preparedBucket = ledger.preparedBucket;
  } else {
    own("bucket");
    await phase("bucketProvision", () =>
      cli(["r2", "bucket", "create", bucketName])
    );
  }
  let sdkAllowed = false;
  try {
    await phase("newBucketSdkHead", () =>
      s3.send(new HeadBucketCommand({ Bucket: bucketName }))
    );
    sdkAllowed = true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status !== 403 && status !== 401) {
      throw error;
    }
    // Prepared-bucket cleanup deletes through these S3 credentials, so a
    // Wrangler upload fallback would leave objects in the shared bucket.
    if (ledger.preparedBucket) {
      throw new Error(
        `Prepared bucket HeadBucket denied HTTP ${status}; its S3 key needs Object Read & Write before any upload.`
      );
    }
    report.publisherLimitation = `New bucket HeadBucket denied HTTP ${status}; supplied R2 S3 token needs Object Read & Write on ${bucketName} (or all test buckets). Existing bucket was not used. Safe Wrangler OAuth upload is a limited alternative, not production publisher proof.`;
    console.log(
      JSON.stringify({
        runId,
        newBucketHeadStatus: status,
        limitedCliAlternative: true,
      })
    );
  }
  own("worker");
  const deployed = await phase("workerProvision", () => cli(["deploy"]));
  const origin = deployed.output.match(
    /https:\/\/[a-z0-9.-]+\.workers\.dev/
  )?.[0];
  if (!origin) {
    throw new Error("No workers.dev URL found in deployment output");
  }
  report.origin = origin;
  const builder = join(root, "apps/sites-builder");
  const stage = join(directory, "toolchain");
  await phase("toolchainStage", () => stageBoxToolchain(stage));
  const archive = join(directory, "toolchain.tgz");
  const tar = spawnSync(
    "tar",
    ["--no-xattrs", "-czf", archive, "-C", stage, "."],
    { env: { ...cliEnv, COPYFILE_DISABLE: "1" } }
  );
  if (tar.status !== 0) {
    throw new Error("Toolchain tar failed");
  }
  const toolchainResource = own("box", "toolchain");
  const box = await phase("toolchainBoxProvision", () =>
    EphemeralBox.create({
      name: toolchainResource.name,
      runtime: "node",
      size: "medium",
      ttl: 600,
      env: {},
      networkPolicy: { mode: "allow-all" },
      apiKey: credentials.UPSTASH_BOX_API_KEY,
    })
  );
  const environmentAudit = await box.exec.command(
    "node -e 'if(Object.keys(process.env).some(k=>/SECRET|TOKEN|API_KEY|DATABASE_URL|ACCESS_KEY|PASSWORD/i.test(k)))process.exit(1);console.log(\"no-secret-env-names\")'"
  );
  if (environmentAudit.exitCode !== 0) {
    throw new Error(
      "Box contains secret-like environment names; refusing snapshot of inherited provider user environment"
    );
  }
  await phase("toolchainUpload", () =>
    box.files.upload([
      { path: archive, destination: `${WORKDIR}/toolchain.tgz` },
    ])
  );
  const install = await phase("toolchainInstall", () =>
    box.exec.command(
      `cd ${WORKDIR} && mkdir -p toolchain && tar xzf toolchain.tgz -C toolchain && rm toolchain.tgz && cd toolchain && env -i PATH="$PATH" HOME="${WORKDIR}" ASTRO_TELEMETRY_DISABLED=1 npm install --omit=dev --no-audit --no-fund --loglevel=error > npm.log 2>&1 && node --version`
    )
  );
  if (install.exitCode !== 0) {
    writeFileSync(
      join(directory, "install.log"),
      redact(
        await box.files
          .read(`${WORKDIR}/toolchain/npm.log`)
          .catch(() => "no install log")
      ),
      { mode: 0o600 }
    );
    throw new Error("Toolchain npm install failed; see isolated install.log");
  }
  report.guestNode = install.result.trim();
  const audit = await box.exec.command(
    `cd ${WORKDIR} && node -e 'const fs=require("fs"); const bad=[]; function walk(p){for(const x of fs.readdirSync(p,{withFileTypes:true})){if(x.name==="node_modules")continue;const q=p+"/"+x.name;if(/^\\.env|credential|secret/i.test(x.name))bad.push(q);if(x.isDirectory())walk(q)}}walk(".");if(bad.length)process.exit(1);console.log("workspace-secret-file-audit-ok")'`
  );
  if (audit.exitCode !== 0) {
    throw new Error("Snapshot filesystem safety audit failed");
  }
  const snapshotResource = own("snapshot");
  const snapshot = await phase("snapshotProvision", () =>
    box.snapshot({ name: snapshotResource.name })
  );
  snapshotResource.id = snapshot.id;
  snapshotResource.retained = true;
  persist();
  report.snapshot = {
    id: snapshot.id,
    bytes: snapshot.size_bytes,
    name: snapshot.name,
  };
  const envPath = join(directory, "snapshot.env");
  writeFileSync(
    envPath,
    `SITES_BUILDER_SNAPSHOT_ID=${snapshot.id}\nUPSTASH_BOX_API_KEY=${credentials.UPSTASH_BOX_API_KEY}\n`,
    { mode: 0o600 }
  );
  await phase("toolchainBoxCleanup", () => box.delete());
  if (!(await absent(toolchainResource))) {
    throw new Error("Toolchain box survived deletion");
  }
  toolchainResource.deleted = true;
  persist();
  process.env.SITES_BUILDER_SNAPSHOT_ID = snapshot.id;
  process.env.SITES_R2_BUCKET = bucketName;
  const { runSandboxBuild } =
    await import("../../../packages/sites-server/src/box-build");
  const source = join(directory, "source.tgz");
  const sourceTar = spawnSync(
    "tar",
    ["--no-xattrs", "-czf", source, "-C", join(builder, "fixtures"), "acme"],
    { env: { ...cliEnv, COPYFILE_DISABLE: "1" } }
  );
  if (sourceTar.status !== 0) {
    throw new Error("Fixture archive failed");
  }
  const siteId = `${runId}-site`;
  let manifest;
  const put = async (
    key: string,
    data: Uint8Array | string,
    contentType: string
  ) => {
    if (!ledger.objectKeys.includes(key)) {
      ledger.objectKeys.push(key);
      persist();
    }
    if (sdkAllowed) {
      const { r2Put } = await import("../../../packages/sites-server/src/r2");
      await r2Put(key, data, { contentType });
    } else {
      const file = join(directory, "object-upload");
      writeFileSync(file, data, { mode: 0o600 });
      await cli([
        "r2",
        "object",
        "put",
        `${bucketName}/${key}`,
        "--file",
        file,
        "--content-type",
        contentType,
        "--remote",
      ]);
    }
  };
  for (let index = 0; index < repeats; index++) {
    const deploymentId = `${runId}-dep-${index}`;
    const resource = own("box", `build-${index}`);
    const target = siteBuildRequestSchema.parse({
      ...JSON.parse(
        readFileSync(join(builder, "fixtures/acme.target.json"), "utf8")
      ),
      siteId,
      deploymentId,
      publicOrigin: origin,
      analytics: false,
      noindex: true,
    });
    const build = await phase(`build-${index}`, () =>
      runSandboxBuild({
        sourceArchive: new Uint8Array(readFileSync(source)),
        rootDirectory: "",
        snapshotId: snapshot.id,
        target,
        onComplete: async (result) => {
          writeFileSync(
            join(directory, `build-${index}.json`),
            JSON.stringify({ ...result, outputArchive: undefined }, null, 2),
            { mode: 0o600 }
          );
        },
      })
    );
    writeFileSync(join(directory, `build-${index}.log`), redact(build.log), {
      mode: 0o600,
    });
    (report.builds as unknown[]).push({
      result: build.result,
      metrics: build.metrics,
    });
    if (!build.metrics?.cleanupSucceeded || !(await absent(resource))) {
      throw new Error("Production sandbox cleanup was not verified");
    }
    resource.deleted = true;
    persist();
    if (!build.result?.ok || !build.outputArchive) {
      throw new Error(
        `Real build failed: ${build.crash ?? "compiler diagnostics"}; see build-${index}.log`
      );
    }
    const outputArchive = build.outputArchive;
    const buildResult = build.result;
    writeFileSync(join(directory, `out-${index}.tgz`), outputArchive, {
      mode: 0o600,
    });
    const deployment = {
      id: deploymentId,
      commitSha: target.commitSha,
      target: siteBuildTargetSchema.parse(target),
      configHash: createHash("sha256")
        .update(JSON.stringify(target))
        .digest("hex"),
    };
    manifest = await phase(`publish-${index}`, async () => {
      const { readTarGz } =
        await import("../../../packages/sites-server/src/utils/read-tar-gz");
      const files = readTarGz(outputArchive, {
        maxFiles: SITE_BUILD_LIMITS.maxOutputFiles,
        maxBytes: SITE_BUILD_LIMITS.maxOutputBytes,
        maxFileBytes: SITE_BUILD_LIMITS.maxSingleFileBytes,
      });
      if (sdkAllowed) {
        for (const file of files) {
          ledger.objectKeys.push(
            SITE_R2_KEYS.file(siteId, deploymentId, `/${file.path}`)
          );
        }
        ledger.objectKeys.push(SITE_R2_KEYS.manifest(siteId, deploymentId));
        persist();
        const { publishDeploymentFiles } =
          await import("../../../packages/sites-server/src/publish");
        return siteManifestSchema.parse(
          await publishDeploymentFiles({
            site: { id: siteId },
            deployment,
            archive: outputArchive,
            result: buildResult,
            toolchainVersion: build.toolchainVersion,
          })
        );
      }
      const { contentTypeForPath } =
        await import("../../../packages/sites-server/src/utils/content-types");
      const manifestFiles = [];
      for (const file of files) {
        const path = `/${file.path}`;
        const contentType = contentTypeForPath(path);
        await put(
          SITE_R2_KEYS.file(siteId, deploymentId, path),
          file.data,
          contentType
        );
        manifestFiles.push({
          path,
          size: file.data.byteLength,
          sha256: createHash("sha256").update(file.data).digest("hex"),
          contentType,
        });
      }
      const record = siteManifestSchema.parse({
        version: 1,
        siteId,
        deploymentId,
        ...deployment,
        toolchainVersion: build.toolchainVersion,
        createdAt: new Date().toISOString(),
        totalBytes: manifestFiles.reduce((sum, file) => sum + file.size, 0),
        files: manifestFiles,
        redirects: buildResult.redirects.map((rule) => ({
          source: rule.source,
          destination: rule.destination,
          status: rule.permanent ? 308 : 307,
        })),
        contentSecurityPolicy: buildResult.contentSecurityPolicy ?? undefined,
      });
      await put(
        SITE_R2_KEYS.manifest(siteId, deploymentId),
        JSON.stringify(record),
        "application/json"
      );
      return record;
    });
    const state = siteServingStateSchema.parse({
      version: 1,
      siteId,
      slug: "acme-e2e",
      status: "active",
      production: {
        deploymentId,
        generation: index + 1,
        activatedAt: new Date().toISOString(),
      },
      previews: {},
      trafficToken: null,
      updatedAt: new Date().toISOString(),
    });
    await phase(`activate-${index}`, async () => {
      await put(
        SITE_R2_KEYS.state(siteId),
        JSON.stringify(state),
        "application/json"
      );
      await put(
        SITE_R2_KEYS.host(new URL(origin).hostname),
        JSON.stringify(
          siteHostRecordSchema.parse({ version: 1, siteId, kind: "custom" })
        ),
        "application/json"
      );
    });
  }
  if (!manifest) {
    throw new Error("No published manifest");
  }
  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 }
  );
  await phase("httpChecks", async () => {
    for (const [label, path, expected] of [
      ["first-observed", "/blog", 200],
      ["warm", "/blog", 200],
      ["changelog", "/changelog", 200],
      ["redirect", "/blog/old-launch", 308],
      ["missing", "/blog/not-existing-e2e", 404],
    ] as const) {
      const start = performance.now();
      const response = await originalFetch(`${origin}${path}`, {
        redirect: "manual",
      });
      const body = await response.text();
      const record = {
        label,
        path,
        status: response.status,
        durationMs: performance.now() - start,
        bytes: Buffer.byteLength(body),
        location: response.headers.get("location"),
        cacheControl: response.headers.get("cache-control"),
      };
      (report.requests as unknown[]).push(record);
      if (response.status !== expected) {
        throw new Error(
          `HTTP ${path}: wanted ${expected}, got ${response.status}`
        );
      }
      if (
        response.status === 200 &&
        (!body.includes("Acme") || /_notra\/insights\.js/.test(body))
      ) {
        throw new Error("Acme content/analytics-off check failed");
      }
      writeFileSync(join(directory, `${label}.html`), body, { mode: 0o600 });
    }
  });
  const cpuMs = (
    report.builds as { metrics?: { sandboxCpuTimeMs?: number | null } }[]
  ).reduce((sum, build) => sum + (build.metrics?.sandboxCpuTimeMs ?? 0), 0);
  report.priceEstimate = {
    measuredBuildCpuTimeMs: cpuMs,
    mediumUsdPerActiveCpuHour: 0.2,
    estimatedBuildCpuUsd: (cpuMs / 3_600_000) * 0.2,
    source: "https://upstash.com/pricing/box",
    checkedAt: new Date().toISOString(),
    excludes:
      "toolchain provisioning CPU, idle/storage/snapshots, R2/Worker requests and transfer; not measured invoice cost",
  };
  report.passed = true;
  report.snapshotEnvPath = envPath;
} catch (error) {
  failure = error;
  report.passed = false;
  report.error = redact(error instanceof Error ? error.message : String(error));
} finally {
  globalThis.fetch = originalFetch;
  try {
    await phase("cleanup", cleanupRun);
  } catch (error) {
    report.passed = false;
    report.cleanupError = redact(
      error instanceof Error ? error.message : String(error)
    );
    failure = error;
  }
  report.remainingOwnedResources = ledger.resources.filter(
    (resource) => !resource.deleted
  );
  report.finishedAt = new Date().toISOString();
  writeFileSync(
    join(directory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    { mode: 0o600 }
  );
  console.log(
    JSON.stringify({
      directory,
      passed: report.passed,
      error: report.error,
      cleanupError: report.cleanupError,
      remaining: report.remainingOwnedResources,
    })
  );
  s3.destroy();
}
if (failure) {
  process.exitCode = 1;
}
