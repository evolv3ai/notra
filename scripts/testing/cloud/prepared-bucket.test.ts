import { expect, test } from "bun:test";

import type { CloudLedger } from "./types/resources";
import {
  assertOwnedObjectKeys,
  requirePreparedBucket,
} from "./utils/prepared-bucket";

test("prepared bucket requires exact account, profile, creation evidence and test name", () => {
  const owned = {
    accountId: "a".repeat(32),
    wranglerProfile: "test-company",
    bucket: "notra-sites-e2e-pipeline-20261013",
    created: true,
    providerCreatedAt: "2026-10-13T09:00:00.000Z",
  };
  expect(
    requirePreparedBucket(owned, owned.accountId, owned.wranglerProfile)
  ).toEqual({
    name: owned.bucket,
    createdAt: owned.providerCreatedAt,
  });
  for (const changed of [
    { accountId: "b".repeat(32) },
    { wranglerProfile: "default" },
    { bucket: "production-bucket" },
    { created: false },
    { providerCreatedAt: "invalid" },
  ]) {
    expect(() =>
      requirePreparedBucket(
        { ...owned, ...changed },
        owned.accountId,
        owned.wranglerProfile
      )
    ).toThrow("not verified");
  }
});

test("shared bucket cleanup accepts only this run's deployment, state and worker host keys", () => {
  const runId = "notra-sites-e2e-12345678";
  const ledger: CloudLedger = {
    version: 1,
    runId,
    resources: [],
    objectKeys: [
      `deployments/${runId}-site/${runId}-dep-0/files/blog/index.html`,
      `deployments/${runId}-site/${runId}-dep-0/manifest.json`,
      `sites/${runId}-site/state.json`,
      `hosts/${runId}-worker.company.workers.dev.json`,
    ],
  };
  assertOwnedObjectKeys(ledger);
  for (const key of [
    "deployments/production-site/live/files/index.html",
    `deployments/${runId}-site/other-run/manifest.json`,
    "sites/production-site/state.json",
    "hosts/production-worker.company.workers.dev.json",
    `deployments/${runId}-site/${runId}-dep-0/files/../foreign`,
  ]) {
    expect(() =>
      assertOwnedObjectKeys({ ...ledger, objectKeys: [key] })
    ).toThrow("outside this exact run");
  }
});
