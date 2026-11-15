import type { SiteIntegrationUpdate } from "@notra/sites-core/types/site-integrations";

import type { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteDomain, SiteScope } from "@/types/sites";

export interface SitePollingQuery<TData> {
  state: { data?: TData };
}

export interface UseSiteDeploymentParams extends SiteScope {
  deploymentId: string;
}

export interface UseSiteDomainCheckParams extends SiteScope {
  domainId: string;
}

export interface UseSiteDomainConnectParams extends SiteScope {
  domain: SiteDomain;
}

export interface UseRebaseSiteDraftsParams extends SiteScope {
  onRebased: () => void;
  onSettled: (paths: readonly string[]) => void;
}

export interface UseSavePreviewAccessParams extends SiteScope {
  onSaved: () => void;
}

export interface SiteAnalyticsWindow {
  days?: number;
  from?: string;
  to?: string;
  path?: string;
}

export interface UseUpdateSiteSettingsOptions {
  onSaved?: () => void;
}

export type SaveSiteIntegrationInput = SiteIntegrationUpdate;
