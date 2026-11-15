export type SitePlan = "free" | "paid";

export type SitePlanLimit = "sites" | "domains" | "branding";

export interface SitePlanQuota {
  used: number;
  /** null when the plan has no workspace cap. */
  limit: number | null;
}

export interface SitePlanUsage {
  plan: SitePlan;
  sites: SitePlanQuota;
  domains: SitePlanQuota;
  brandingRequired: boolean;
}
