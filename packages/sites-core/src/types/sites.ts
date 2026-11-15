import type {
  SITE_DEPLOYMENT_STATUSES,
  SITE_CONSOLE_ACTIONS,
  SITE_SUSPENDERS,
  SITE_SUSPENSION_CATEGORIES,
} from "@notra/sites-core/constants/sites";

export type SiteDeploymentStatus = (typeof SITE_DEPLOYMENT_STATUSES)[number];
export type SiteSuspender = (typeof SITE_SUSPENDERS)[number];
export type SiteConsoleAction = (typeof SITE_CONSOLE_ACTIONS)[number];
export type SiteSuspensionCategory =
  (typeof SITE_SUSPENSION_CATEGORIES)[number];
