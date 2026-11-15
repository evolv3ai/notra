import { SiteDesignSkeleton } from "@/components/sites/site-page-skeleton";
import type { SiteSectionUiPage } from "@/types/ui-route";
import { lazyPage } from "@/utils/lazy-page";

const Analytics = lazyPage(() =>
  import("@/components/sites/pages/site-analytics-page").then((module) => ({
    default: module.SiteAnalyticsPage,
  }))
);
const Deployments = lazyPage(() =>
  import("@/components/sites/pages/site-deployments-page").then((module) => ({
    default: module.SiteDeploymentsPage,
  }))
);
const Domains = lazyPage(() =>
  import("@/components/sites/pages/site-domains-page").then((module) => ({
    default: module.SiteDomainsPage,
  }))
);
const Design = lazyPage(() =>
  import("@/components/sites/pages/site-design-page").then((module) => ({
    default: module.SiteDesignPage,
  }))
);
const Settings = lazyPage(() =>
  import("@/components/sites/pages/site-settings-page").then((module) => ({
    default: module.SiteSettingsPage,
  }))
);

export const SITE_SECTION_PAGES: readonly SiteSectionUiPage[] = [
  { section: "analytics", page: Analytics },
  { section: "deployments", page: Deployments },
  { section: "domains", page: Domains },
  { section: "design", page: Design, skeleton: SiteDesignSkeleton },
  { section: "settings", page: Settings },
];
