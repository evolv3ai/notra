import { expect, test } from "bun:test";

import type { CloudLedger } from "./types/resources";
import { ownedBoxFetch } from "./utils/owned-box-fetch";
import {
  assertOwned,
  cleanupOwned,
  matchOwnedProviderResources,
  requireSnapshotId,
} from "./utils/ownership";
import { readCloudPreviewSecret, redactCloudOutput } from "./utils/redaction";

test("cleanup refuses prefixes, foreign IDs, and resources not in the ledger", () => {
  const ledger: CloudLedger = {
    version: 1,
    runId: "notra-sites-e2e-12345678",
    resources: [],
    objectKeys: [],
  };
  const resource = { kind: "bucket" as const, name: `${ledger.runId}-bucket` };
  expect(() => assertOwned(ledger, resource)).toThrow();
  ledger.resources.push(resource);
  assertOwned(ledger, resource);
  resource.name = "notra-sites-dev";
  expect(() => assertOwned(ledger, resource)).toThrow();
  ledger.runId = "notra-sites-e2e-";
  expect(() => assertOwned(ledger, resource)).toThrow();
});

test("recovery checks already deleted resources, preserves snapshots, and continues after failures", async () => {
  const runId = "notra-sites-e2e-12345678";
  const ledger: CloudLedger = {
    version: 1,
    runId,
    objectKeys: [],
    resources: [
      { kind: "bucket", name: `${runId}-bucket` },
      { kind: "worker", name: `${runId}-worker` },
      { kind: "snapshot", name: `${runId}-snapshot`, retained: true },
    ],
  };
  const removed: string[] = [];
  const existing = new Set(["bucket", "worker"]);
  await expect(
    cleanupOwned(
      ledger,
      async (r) => {
        removed.push(r.kind);
        if (r.kind === "worker") {
          throw new Error("API unavailable");
        }
        existing.delete(r.kind);
      },
      async (r) => !existing.has(r.kind),
      () => {}
    )
  ).rejects.toThrow("API unavailable");
  expect(removed).toEqual(["worker", "bucket"]);
  await cleanupOwned(
    ledger,
    async (r) => {
      existing.delete(r.kind);
    },
    async (r) => !existing.has(r.kind),
    () => {}
  );
  expect(ledger.resources[0]?.deleted).toBe(true);
  expect(ledger.resources[1]?.deleted).toBe(true);
  expect(ledger.resources[2]?.deleted).toBeUndefined();
});

test("Box allocation guard handles Request objects used by production Effect transport", async () => {
  const runId = "notra-sites-e2e-12345678";
  const ledger: CloudLedger = {
    version: 1,
    runId,
    objectKeys: [],
    resources: [
      { kind: "snapshot", name: `${runId}-snapshot`, id: "snapshot-test" },
      { kind: "box", name: `${runId}-build-0` },
    ],
  };
  let calls = 0;
  let saves = 0;
  const guard = ownedBoxFetch(
    ledger,
    () => {
      saves++;
    },
    (async (input) => {
      const request = new Request(input);
      const body = await request.json();
      expect(body.name).toBe(`${runId}-build-0`);
      expect(body.ttl).toBe(600);
      expect(body.keep_alive).toBe(false);
      expect(body.env_vars).toEqual({});
      calls++;
      return Response.json({ id: "box-test" });
    }) as typeof fetch
  );
  const url = "https://us-east-1.box.upstash.com/v2/box/from-snapshot";
  await guard(
    new Request(url, {
      method: "POST",
      body: JSON.stringify({
        snapshot_id: "snapshot-test",
        name: `notra-site-${runId.slice(0, 16)}`,
        ttl: 900,
      }),
    })
  );
  expect(ledger.resources[1]?.id).toBe("box-test");
  expect(saves).toBe(1);
  await expect(
    guard(url, {
      method: "POST",
      body: JSON.stringify({
        name: "production-box",
        snapshot_id: "snapshot-test",
      }),
    })
  ).rejects.toThrow("Unowned");
  expect(calls).toBe(1);
});

test("Box and snapshot recovery refuse foreign IDs and matching names with stale IDs", async () => {
  for (const kind of ["box", "snapshot"] as const) {
    const runId = "notra-sites-e2e-12345678";
    const resource = {
      kind,
      name: `${runId}-${kind === "box" ? "build-0" : "snapshot"}`,
      id: "production-id",
    };
    const ledger: CloudLedger = {
      version: 1,
      runId,
      objectKeys: [],
      resources: [resource],
    };
    const actual = [
      {
        id: "production-id",
        name: "existing-production-resource",
        status: "ready",
      },
    ];
    let deletes = 0;
    await expect(
      cleanupOwned(
        ledger,
        async () => {
          deletes++;
        },
        async (owned) =>
          matchOwnedProviderResources(ledger, owned, actual).length === 0,
        () => {}
      )
    ).rejects.toThrow("name/ID mismatch");
    expect(deletes).toBe(0);
    expect(resource).not.toHaveProperty("deleted");
    expect(() =>
      matchOwnedProviderResources(ledger, resource, [
        { id: "different-id", name: resource.name, status: "ready" },
      ])
    ).toThrow("name/ID mismatch");
    expect(() =>
      matchOwnedProviderResources(ledger, resource, [
        { id: resource.id, status: "ready" },
      ])
    ).toThrow("name/ID mismatch");
    expect(
      matchOwnedProviderResources(ledger, resource, [
        { id: resource.id, name: resource.name, status: "ready" },
      ])
    ).toHaveLength(1);
    expect(matchOwnedProviderResources(ledger, resource, [])).toEqual([]);
  }
});

test("Wrangler output redacts generated and recovered preview secrets", () => {
  const generated = "new-private-test-preview-secret";
  const recovered = readCloudPreviewSecret({
    vars: { PREVIEW_SECRET: "saved-private-test-preview-secret" },
  });
  const output = `deploy vars: ${generated}; failure vars: ${recovered}; selected-key`;
  expect(
    redactCloudOutput(output, ["selected-key", generated, recovered])
  ).toBe("deploy vars: [redacted]; failure vars: [redacted]; [redacted]");
  expect(() => readCloudPreviewSecret({ vars: {} })).toThrow(
    "missing a preview secret"
  );
});

test("snapshot deletion never sends a missing or malformed ID", () => {
  expect(requireSnapshotId("5f954207-49b3-4993-8d8b-ded578e336c9")).toBe(
    "5f954207-49b3-4993-8d8b-ded578e336c9"
  );
  for (const id of [undefined, null, "", "a b", "../x", 42, ["id"]]) {
    expect(() => requireSnapshotId(id)).toThrow("without an exact ID");
  }
});
