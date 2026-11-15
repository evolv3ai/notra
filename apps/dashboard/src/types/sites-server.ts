import type { siteDeployments, siteDomains } from "@notra/db/schema";
import type { Site } from "@notra/sites-server/types/sites";

import type { serializeSite } from "@/lib/sites/serialize";
import type { SiteDomainConnectOutcome } from "@/types/sites";

export type SiteDeploymentDbRow = typeof siteDeployments.$inferSelect;
export type SiteDomainDbRow = typeof siteDomains.$inferSelect;

export type LiveDeployments = Map<string, string>;

export interface SiteRequestContext {
  headers: Headers;
}

export interface SiteAccessOptions {
  admin?: boolean;
}

export interface SiteAccess {
  site: Site;
  userId: string;
}

export interface SiteDeploymentAccess extends SiteAccess {
  canManageDeployments: boolean;
}

export interface SiteDeploymentActionsContext {
  history: readonly Pick<SiteDeploymentDbRow, "id" | "configHash">[];
  currentHash: string;
  liveDeploymentId: string | null;
  rollbackActive: boolean;
  canManageDeployments: boolean;
  siteActive: boolean;
}

export interface SiteJobSweepResult {
  dispatched: number;
  reaped: number;
}

export interface SiteJobRunHandle {
  runId: string;
}

export interface FinishDnsCallbackParams {
  request: Request;
  site: Site;
  domainId: string;
  userId: string;
  outcome: SiteDomainConnectOutcome;
}

/** One row of a bulk import: the created site, or why it failed. */
export type CreateSitesResult =
  | {
      rootDirectory: string;
      site: ReturnType<typeof serializeSite>;
      deploymentQueued: boolean;
    }
  | { rootDirectory: string; error: string };
