import type { SiteSuspensionCategory } from "@notra/sites-core/types/sites";

export interface SuspensionNotice {
  organizationId: string;
  scope: "site" | "workspace";
  siteNames: string[];
  category: SiteSuspensionCategory;
  reason: string;
  /** Stable per suspension: a retry re-sends only the notices that failed. */
  key: string;
}
