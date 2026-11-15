import { renameSync, writeFileSync } from "node:fs";

import type {
  CloudLedger,
  OwnedResource,
  ProviderResource,
} from "../types/resources";

export function assertOwned(ledger: CloudLedger, resource: OwnedResource) {
  if (!/^notra-sites-e2e-[a-z0-9-]{8,40}$/.test(ledger.runId)) {
    throw new Error("Invalid test run identity");
  }
  if (
    !ledger.resources.includes(resource) ||
    !resource.name.startsWith(`${ledger.runId}-`) ||
    !/^[a-z0-9-]+$/.test(resource.name)
  ) {
    throw new Error("Refusing a resource outside the exact ownership ledger");
  }
  const suffix = resource.name.slice(ledger.runId.length + 1);
  const allowed =
    resource.kind === "box"
      ? /^(toolchain|build-[0-2])$/.test(suffix)
      : ["bucket", "worker", "snapshot"].includes(resource.kind) &&
        suffix === resource.kind;
  if (!allowed) {
    throw new Error("Resource kind/name is outside the benchmark allowlist");
  }
  if (resource.id && !/^[a-zA-Z0-9_-]+$/.test(resource.id)) {
    throw new Error("Unsafe provider resource ID");
  }
}

// Box deletes every snapshot on the account when the request carries no IDs,
// and the account also holds production snapshots.
export function requireSnapshotId(id: unknown): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new Error("Refusing to delete a Box snapshot without an exact ID");
  }
  return id;
}

export function saveLedger(path: string, ledger: CloudLedger) {
  for (const resource of ledger.resources) {
    assertOwned(ledger, resource);
  }
  writeFileSync(`${path}.next`, `${JSON.stringify(ledger, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(`${path}.next`, path);
}

export function matchOwnedProviderResources(
  ledger: CloudLedger,
  resource: OwnedResource,
  actual: ProviderResource[]
) {
  assertOwned(ledger, resource);
  const byName = actual.filter(
    (entry) => entry.name === resource.name && entry.status !== "deleted"
  );
  if (resource.id) {
    const byId = actual.find((entry) => entry.id === resource.id);
    if (
      (byId && byId.name !== resource.name) ||
      byName.some((entry) => entry.id !== resource.id)
    ) {
      throw new Error("Provider name/ID mismatch; refusing cleanup");
    }
    return byId && byId.status !== "deleted" ? [byId] : [];
  }
  if (byName.length > 1) {
    throw new Error("Provider name recovery is ambiguous; refusing cleanup");
  }
  return byName;
}

export async function cleanupOwned(
  ledger: CloudLedger,
  remove: (resource: OwnedResource) => Promise<void>,
  absent: (resource: OwnedResource) => Promise<boolean>,
  persist: () => void
) {
  const errors: string[] = [];
  for (const resource of [...ledger.resources].reverse()) {
    assertOwned(ledger, resource);
    if (resource.retained) {
      continue;
    }
    try {
      if (!(await absent(resource))) {
        await remove(resource);
      }
      if (!(await absent(resource))) {
        throw new Error("Resource remains after cleanup");
      }
      resource.deleted = true;
      persist();
    } catch (error) {
      errors.push(
        `${resource.kind} ${resource.name}: ${error instanceof Error ? error.message : "cleanup failed"}`
      );
    }
  }
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}
