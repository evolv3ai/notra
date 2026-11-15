import type { CloudLedger, PreparedBucketLedger } from "../types/resources";

export function requirePreparedBucket(
  ledger: PreparedBucketLedger,
  accountId: string,
  profile: string
) {
  if (
    ledger.accountId !== accountId ||
    ledger.wranglerProfile !== profile ||
    ledger.created !== true ||
    !/^notra-sites-e2e-pipeline-\d{8}$/.test(ledger.bucket) ||
    !ledger.providerCreatedAt ||
    !Number.isFinite(Date.parse(ledger.providerCreatedAt))
  ) {
    throw new Error(
      "Prepared bucket ownership/account/profile is not verified"
    );
  }
  return { name: ledger.bucket, createdAt: ledger.providerCreatedAt };
}

export function assertOwnedObjectKeys(ledger: CloudLedger) {
  if (!/^notra-sites-e2e-[a-z0-9-]{8,40}$/.test(ledger.runId)) {
    throw new Error("Invalid test run identity");
  }
  const siteId = `${ledger.runId}-site`;
  const deployment = new RegExp(
    `^deployments/${siteId}/${ledger.runId}-dep-[0-2]/(?:files/.+|manifest\\.json)$`
  );
  for (const key of ledger.objectKeys) {
    if (
      key.includes("..") ||
      !(
        deployment.test(key) ||
        key === `sites/${siteId}/state.json` ||
        (key.startsWith(`hosts/${ledger.runId}-worker.`) &&
          key.endsWith(".workers.dev.json"))
      )
    ) {
      throw new Error("Refusing cleanup of an object outside this exact run");
    }
  }
}
