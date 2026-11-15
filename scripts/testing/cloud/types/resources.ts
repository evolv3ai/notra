export interface OwnedResource {
  kind: "bucket" | "worker" | "box" | "snapshot";
  name: string;
  id?: string;
  deleted?: boolean;
  retained?: boolean;
}

export interface CloudLedger {
  version: 1;
  runId: string;
  cloudflareAccountId?: string;
  wranglerProfile?: string;
  preparedBucket?: { name: string; createdAt: string };
  resources: OwnedResource[];
  objectKeys: string[];
}

export interface PreparedBucketLedger {
  accountId: string;
  wranglerProfile: string;
  bucket: string;
  created: boolean;
  providerCreatedAt: string;
}

export interface ProviderResource {
  id: string;
  name?: string;
  status: string;
}
