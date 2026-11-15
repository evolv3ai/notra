import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { BOX_BASE_URL } from "../../../../packages/ai/src/constants/repo-image";

const SNAPSHOT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const NAME_PREFIX = "notra-sites-e2e-lifecycle";
// Older than any lifecycle run; younger snapshots may belong to a live run.
const STALE_AFTER_SECONDS = 2 * 60 * 60;

// Builds a Box snapshot from the checked-out toolchain, so the real-Box
// lifecycle tests exactly this commit's builder rather than production's.
export async function createTestSnapshot(
  root: string,
  directory: string,
  apiKey: string,
  run: (
    args: string[],
    env: NodeJS.ProcessEnv,
    timeoutMs: number,
    cwd: string
  ) => Promise<{ status: number | null; output: string }>
) {
  const resultFile = join(directory, "box-snapshot.json");
  const result = await run(
    [
      "--no-env-file",
      "scripts/create-box-snapshot.ts",
      "--name-prefix",
      // Box names are unique per account; concurrent runs need their own.
      `${NAME_PREFIX}-${randomUUID().slice(0, 8)}`,
      "--result-file",
      resultFile,
    ],
    {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      UPSTASH_BOX_API_KEY: apiKey,
    },
    600_000,
    join(root, "apps/sites-builder")
  );
  if (result.status !== 0) {
    // The snapshot can exist even when the script fails afterwards (e.g. the
    // toolchain Box would not delete), so remove it before giving up.
    const saved = existsSync(resultFile)
      ? JSON.parse(readFileSync(resultFile, "utf8")).snapshotId
      : null;
    if (typeof saved === "string") {
      await deleteTestSnapshot(saved, apiKey);
    }
    throw new Error(
      `Box snapshot creation failed:\n${result.output.replaceAll(apiKey, "[redacted]").slice(-4000)}`
    );
  }
  const { version, snapshotId } = JSON.parse(readFileSync(resultFile, "utf8"));
  if (typeof snapshotId !== "string" || !SNAPSHOT_ID.test(snapshotId)) {
    throw new Error("Box snapshot creation returned no snapshot ID");
  }
  return { version: String(version), snapshotId };
}

// The Box API deletes every snapshot on the account when `ids` is missing or
// empty, and this account also holds production snapshots. Only ever send one
// validated ID.
export async function deleteTestSnapshot(snapshotId: unknown, apiKey: string) {
  // RegExp#test stringifies its input, so `undefined` would pass on its own.
  if (typeof snapshotId !== "string" || !SNAPSHOT_ID.test(snapshotId)) {
    throw new Error("Refusing to delete a Box snapshot without an exact ID");
  }
  const response = await fetch(`${BOX_BASE_URL}/v2/box/snapshots`, {
    method: "DELETE",
    headers: { "X-Box-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [snapshotId] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Box snapshot deletion failed with HTTP ${response.status}`
    );
  }
}

// A cancelled CI run never reaches its cleanup, so each run removes lifecycle
// snapshots that earlier runs left behind.
export async function sweepStaleTestSnapshots(apiKey: string) {
  const response = await fetch(`${BOX_BASE_URL}/v2/box/snapshots`, {
    headers: { "X-Box-Api-Key": apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Box snapshot listing failed with HTTP ${response.status}`);
  }
  const { snapshots } = (await response.json()) as {
    snapshots: { id?: unknown; name?: unknown; created_at?: unknown }[];
  };
  const cutoff = Date.now() / 1000 - STALE_AFTER_SECONDS;
  const stale = snapshots.filter(
    (snapshot) =>
      typeof snapshot.id === "string" &&
      typeof snapshot.name === "string" &&
      snapshot.name.startsWith(`${NAME_PREFIX}-`) &&
      typeof snapshot.created_at === "number" &&
      snapshot.created_at < cutoff
  );
  for (const snapshot of stale) {
    await deleteTestSnapshot(snapshot.id, apiKey);
  }
  return stale.length;
}
