import { autumn } from "@notra/ai/billing/autumn";
import { resolveOrganizationPlan } from "@notra/ai/billing/plan";
import { db } from "@notra/db/drizzle";
import { siteDomains, sites } from "@notra/db/schema";
import { and, count, eq, sql } from "drizzle-orm";

import {
  FREE_PLAN_LIMITS,
  SITE_PLAN_UNAVAILABLE_MESSAGE,
} from "./constants/plan-limits";
import { SiteInputError, SitePlanLimitError } from "./errors/sites";
import type { SiteStorageTransaction } from "./types/deployments";
import type { SitePlan, SitePlanUsage } from "./types/plan-limits";
import { errorMessage } from "./utils/errors";

/**
 * The workspace's plan for Sites limits, from the same Autumn check the AI
 * gateway uses. Without Autumn outside production (local development, tests)
 * every workspace is unlimited, as the dashboard's other plan gates are.
 */
export async function resolveSitePlan(
  organizationId: string
): Promise<SitePlan> {
  if (!autumn && process.env.NODE_ENV !== "production") {
    return "paid";
  }
  try {
    return await resolveOrganizationPlan(organizationId);
  } catch (error) {
    console.warn("sites.plan_lookup_failed", {
      organizationId,
      error: errorMessage(error),
    });
    throw new SiteInputError(SITE_PLAN_UNAVAILABLE_MESSAGE);
  }
}

async function countUsage(
  executor: Pick<SiteStorageTransaction, "select">,
  organizationId: string
) {
  const [[siteRow], [domainRow]] = await Promise.all([
    executor
      .select({ total: count() })
      .from(sites)
      .where(eq(sites.organizationId, organizationId)),
    executor
      .select({ total: count() })
      .from(siteDomains)
      .where(eq(siteDomains.organizationId, organizationId)),
  ]);
  return { sites: siteRow?.total ?? 0, domains: domainRow?.total ?? 0 };
}

/**
 * Rejects a new site or custom domain past the Free plan's workspace cap.
 * Run inside the transaction that inserts the row: the advisory lock
 * serializes concurrent additions in one workspace.
 */
export async function assertSitePlanAllows(
  tx: SiteStorageTransaction,
  organizationId: string,
  plan: SitePlan,
  limit: "sites" | "domains"
): Promise<void> {
  if (plan !== "free") {
    return;
  }
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`sites-plan:${organizationId}`}, 0))`
  );
  const usage = await countUsage(tx, organizationId);
  if (usage[limit] >= FREE_PLAN_LIMITS[limit]) {
    throw new SitePlanLimitError(limit);
  }
}

export async function getSitePlanUsage(
  organizationId: string
): Promise<SitePlanUsage> {
  const [plan, usage] = await Promise.all([
    resolveSitePlan(organizationId),
    countUsage(db, organizationId),
  ]);
  const free = plan === "free";
  return {
    plan,
    sites: { used: usage.sites, limit: free ? FREE_PLAN_LIMITS.sites : null },
    domains: {
      used: usage.domains,
      limit: free ? FREE_PLAN_LIMITS.domains : null,
    },
    brandingRequired: free,
  };
}

/**
 * Turns the badge back on for a Free workspace's site before it builds, so a
 * downgraded workspace or a stored setting can't publish without it. The flag
 * is persisted so rollbacks and smart builds compare against the same target.
 * A failed plan lookup keeps the stored setting rather than blocking builds.
 */
export async function enforceSitePlanBranding(siteId: string): Promise<void> {
  const [site] = await db
    .select({
      organizationId: sites.organizationId,
      showBranding: sites.showBranding,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (!site || site.showBranding) {
    return;
  }
  const plan = await resolveSitePlan(site.organizationId).catch(() => null);
  if (plan !== "free") {
    return;
  }
  await db
    .update(sites)
    .set({ showBranding: true })
    .where(and(eq(sites.id, siteId), eq(sites.showBranding, false)));
}
