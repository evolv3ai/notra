import "@/workflows/runtime";
import {
  ingestSocialAccountStats,
  ingestSocialAccounts,
  ingestSocialPostStats,
  ingestSocialPosts,
  isTinybirdConfigured,
} from "@notra/analytics/tinybird/client";
import { db } from "@notra/db/drizzle";
import {
  connectedSocialAccounts,
  trackedSocialAccounts,
} from "@notra/db/schema";
import { isDemoMode } from "@notra/utils/demo-mode";
import { eq } from "drizzle-orm";

import { isAnalyticsEnabledForOrganization } from "@/lib/analytics/flag";
import { buildAccountRow } from "@/lib/analytics/rows";
import { collectTwitterRows } from "@/lib/analytics/twitter-sync";
import type { SyncableSocialAccount } from "@/types/analytics";

async function filterFlaggedOrganizations(
  accounts: SyncableSocialAccount[]
): Promise<SyncableSocialAccount[]> {
  const organizationIds = [
    ...new Set(accounts.map((account) => account.organizationId)),
  ];
  const flags = await Promise.all(
    organizationIds.map(async (organizationId) => ({
      organizationId,
      enabled: await isAnalyticsEnabledForOrganization(organizationId),
    }))
  );
  const enabledOrganizations = new Set(
    flags.filter((flag) => flag.enabled).map((flag) => flag.organizationId)
  );
  return accounts.filter((account) =>
    enabledOrganizations.has(account.organizationId)
  );
}

function accountKeys(account: {
  organizationId: string;
  provider: string;
  providerAccountId: string;
  username: string;
}): string[] {
  const prefix = `${account.organizationId}:${account.provider}`;
  return [
    `${prefix}:${account.providerAccountId}`,
    `${prefix}:@${account.username.toLowerCase()}`,
  ];
}

export async function listSyncableAccounts(
  organizationId?: string
): Promise<SyncableSocialAccount[]> {
  "use step";
  if (!isTinybirdConfigured() || isDemoMode()) {
    return [];
  }
  const [accounts, tracked] = await Promise.all([
    db.query.connectedSocialAccounts.findMany({
      columns: {
        id: true,
        organizationId: true,
        provider: true,
        providerAccountId: true,
        username: true,
        displayName: true,
        profileImageUrl: true,
        verified: true,
      },
      ...(organizationId
        ? { where: eq(connectedSocialAccounts.organizationId, organizationId) }
        : {}),
    }),
    db.query.trackedSocialAccounts.findMany({
      columns: {
        id: true,
        organizationId: true,
        provider: true,
        providerAccountId: true,
        username: true,
        displayName: true,
        profileImageUrl: true,
      },
      ...(organizationId
        ? { where: eq(trackedSocialAccounts.organizationId, organizationId) }
        : {}),
    }),
  ]);

  const connected: SyncableSocialAccount[] = accounts.map((account) => ({
    ...account,
    verified: account.verified ?? false,
  }));

  const connectedKeys = new Set(connected.flatMap(accountKeys));

  const trackedOnly: SyncableSocialAccount[] = tracked
    .filter(
      (account) => !accountKeys(account).some((key) => connectedKeys.has(key))
    )
    .map((account) => ({ ...account, verified: false }));

  return await filterFlaggedOrganizations([...connected, ...trackedOnly]);
}

export async function snapshotAccountDimensions(
  accounts: SyncableSocialAccount[]
): Promise<number> {
  "use step";
  const capturedAt = new Date();
  const rows = accounts.map((account) => buildAccountRow(account, capturedAt));
  await ingestSocialAccounts(rows);
  return rows.length;
}

export async function syncTwitterAnalytics(
  accounts: SyncableSocialAccount[]
): Promise<{ accountStats: number; posts: number }> {
  "use step";
  const capturedAt = new Date();
  const twitterAccounts = accounts.filter(
    (account) => account.provider === "twitter"
  );
  const rows = await collectTwitterRows(twitterAccounts, capturedAt);
  await ingestSocialAccountStats(rows.accountStats);
  await ingestSocialPosts(rows.posts);
  await ingestSocialPostStats(rows.postStats);
  return { accountStats: rows.accountStats.length, posts: rows.posts.length };
}
