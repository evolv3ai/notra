import {
  Alert02Icon,
  Analytics01Icon,
  DashboardSquare01Icon,
  FileEditIcon,
  PlugSocketIcon,
  GitPullRequestIcon,
  Globe02Icon,
  Rocket01Icon,
  RefreshIcon,
  Settings01Icon,
  Cancel01Icon,
  Clock01Icon,
  Loading03Icon,
  PaintBoardIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { TABLE_BODY_CLASS } from "ui/table/constants";

import type {
  SiteDeploymentKind,
  SiteDeploymentStatus,
  SiteDeploymentTrigger,
  SiteDomainChipStatus,
  SiteSection,
  SiteSectionConfig,
  SitesEmptyPoint,
  PostPreviewState,
  SiteStatusBadgeConfig,
} from "@/types/sites";

export const SITES_NAV_LINK = "/sites";
export const SITES_BULK_IMPORT_FLAG_KEY = "sites-bulk-import";
export const SITES_FLAG_TIMEOUT_MS = 3000;

export const SITE_ACTIVE_POLL_INTERVAL_MS = 2000;
export const SITE_IDLE_POLL_INTERVAL_MS = 15_000;
export const SITE_ANALYTICS_POLL_INTERVAL_MS = 60_000;
export const SITE_OVERVIEW_ANALYTICS_DAYS = 7;

export const SITE_DEPLOYMENT_IN_PROGRESS_STATUSES: ReadonlySet<SiteDeploymentStatus> =
  new Set(["queued", "building", "uploading"]);

export const SITE_DETAIL_TABS = [
  "overview",
  "analytics",
  "deployments",
  "domains",
  "integrations",
  "design",
  "settings",
] as const;

export const SITE_SECTIONS: readonly SiteSectionConfig[] = [
  { section: "overview", path: "", icon: DashboardSquare01Icon },
  { section: "design", path: "/design", icon: PaintBoardIcon },
  { section: "analytics", path: "/analytics", icon: Analytics01Icon },
  { section: "deployments", path: "/deployments", icon: Rocket01Icon },
  { section: "domains", path: "/domains", icon: Globe02Icon },
  { section: "integrations", path: "/integrations", icon: PlugSocketIcon },
  { section: "settings", path: "/settings", icon: Settings01Icon },
];

/** Pages with a tab above every site page; the rest are linked from them. */
export const SITE_NAV_SECTIONS: ReadonlySet<SiteSection> = new Set([
  "overview",
  "design",
  "analytics",
  "domains",
  "settings",
]);

export const SITES_DOCS_URL = "https://www.usenotra.com/docs/sites";

export const SITES_EMPTY_POINTS: readonly SitesEmptyPoint[] = [
  { key: "write", icon: FileEditIcon },
  { key: "deploy", icon: GitPullRequestIcon },
  { key: "domain", icon: Globe02Icon },
];
export const SITES_EMPTY_EXAMPLE_FILENAME = "blog/hello-world.mdx";
export const SITES_EMPTY_EXAMPLE_POST = `---
title: "Hello, world"
description: "The first post on our new blog."
date: 2026-11-03
---

<Tip>This post went live with a single git push.</Tip>`;
export const SITES_EMPTY_PUSH_COMMAND = `git add ${SITES_EMPTY_EXAMPLE_FILENAME} && git commit -m "Add first post" && git push`;

export const SITE_RECENT_DEPLOYMENTS_LIMIT = 5;
export const SITE_DEPLOYMENTS_PAGE_SIZE = 20;
export const SITE_OVERVIEW_PREVIEWS_LIMIT = 5;
export const SITE_TABLE_EMPTY_HEIGHT = 340;
export const SITE_TABLE_COMPACT_EMPTY_HEIGHT = 300;
export const SITE_SHORT_SHA_LENGTH = 7;
export const SITE_SHARE_LINK_DAYS = 7;
export const POST_PREVIEW_POLL_MS = 2000;
export const POST_PREVIEW_LIFETIME_OPTIONS = ["1h", "1d", "3d", "7d"] as const;

export const SITE_DEFAULT_BLOG_PATH = "/blog";
export const SITE_DEFAULT_CHANGELOG_PATH = "/changelog";
export const SITE_PROXY_RECIPES = [
  "vercel",
  "next",
  "netlify",
  "tanstack",
  "cloudflare",
  "nginx",
] as const;

export const SITE_DOMAIN_CONNECT_STALE_MS = 10 * 60 * 1000;
export const SITE_DOMAIN_CONNECT_PARAM = "domainConnect";
export const SITE_DOMAIN_CONNECT_OUTCOMES = [
  "success",
  "cancelled",
  "error",
] as const;

export const SITE_DOMAIN_STATUS_BADGES: Record<
  SiteDomainChipStatus,
  SiteStatusBadgeConfig
> = {
  active: { variant: "success", icon: Tick02Icon, square: true },
  dnsRequired: { variant: "warning", icon: Alert02Icon },
  proxyRequired: { variant: "warning", icon: Alert02Icon },
  verifying: { variant: "info", icon: Loading03Icon, spin: true },
  failed: { variant: "destructive", icon: Cancel01Icon, square: true },
};

export const SITE_MANUAL_TRIGGER_ICONS: Partial<
  Record<SiteDeploymentTrigger, IconSvgElement>
> = {
  manual: RefreshIcon,
  redeploy: RefreshIcon,
  config: Settings01Icon,
};

export const SITE_STATUS_BADGES: Record<
  SiteDeploymentStatus,
  SiteStatusBadgeConfig
> = {
  queued: { variant: "info", icon: Clock01Icon },
  building: { variant: "warning", icon: Loading03Icon, spin: true },
  uploading: { variant: "warning", icon: Loading03Icon, spin: true },
  ready: { variant: "success", icon: Tick02Icon, square: true },
  failed: { variant: "destructive", icon: Cancel01Icon, square: true },
  superseded: { variant: "secondary" },
  skipped: { variant: "secondary" },
  canceled: { variant: "secondary" },
  expired: { variant: "secondary" },
};

export const POST_PREVIEW_STATUS_BADGES: Record<
  PostPreviewState,
  SiteStatusBadgeConfig
> = {
  none: { variant: "secondary" },
  building: { variant: "warning", icon: Loading03Icon, spin: true },
  live: { variant: "success", icon: Tick02Icon, square: true },
  expired: { variant: "secondary", icon: Clock01Icon },
  failed: { variant: "destructive", icon: Cancel01Icon, square: true },
};

export const SITE_DEPLOYMENT_ROW_HEIGHT = 48;

export const SITE_ENVIRONMENT_ICONS: Record<
  SiteDeploymentKind,
  IconSvgElement
> = {
  production: Rocket01Icon,
  preview: GitPullRequestIcon,
};

export const SITE_REPOSITORY_SUGGESTIONS_STALE_MS = 60_000;

export const SITE_DEPLOYMENTS_PAGE_LIMIT = 100;

export const SITE_DEPLOYMENT_ENVIRONMENT_FILTERS = [
  "all",
  "production",
  "preview",
] as const;

export const SITE_DEPLOYMENT_STATUS_FILTERS = [
  "all",
  "ready",
  "building",
  "queued",
  "failed",
  "canceled",
  "superseded",
  "skipped",
  "expired",
] as const;

export const SITE_BUILD_LOG_FOLLOW_THRESHOLD = 32;

export const SITE_ADMIN_ROLES: ReadonlySet<string> = new Set([
  "owner",
  "admin",
]);

export const SITES_ONLY_GITHUB_EVENTS: ReadonlySet<string> = new Set([
  "push",
  "check_run",
]);

export const SITE_PREVIEW_KEY_PATTERN = /^(?:pr|br|post)-[a-z0-9-]{1,40}$/;

export const SITES_PAGE_SKELETON_ROWS = 3;

/** Rows per site sidebar group: pages, Appearance, Layout, Configuration. */
export const SITE_SIDEBAR_SKELETON_GROUPS = [
  ["overview", "analytics", "domains", "settings"],
  ["general", "styling", "branding", "typography"],
  ["navbar", "banner", "footer"],
  ["integrations", "seo"],
] as const;

export const SITE_PREVIEW_VIEWPORT_WIDTH = 1280;
export const SITE_PREVIEW_VIEWPORT_HEIGHT = 800;
export const SITE_PREVIEW_REACHABILITY_TIMEOUT_MS = 8000;
export const SITE_PREVIEW_REACHABILITY_STALE_MS = 60_000;

export const SITE_OVERVIEW_LINK_CLASS =
  "text-foreground decoration-foreground/25 hover:decoration-foreground min-w-0 truncate underline underline-offset-4 transition-colors duration-150";

export const SITE_BUILD_LOG_ROW_GRID =
  "grid grid-cols-[2rem_0.875rem_minmax(0,1fr)] gap-x-2 px-3 sm:grid-cols-[2.5rem_0.875rem_minmax(0,1fr)] group-data-[timestamps=false]/log:grid-cols-[0.875rem_minmax(0,1fr)]";

export const SITE_DOMAIN_URL_SCHEME_PATTERN = /^https?:\/\//i;

export const SITE_CLOUDFLARE_PROVIDER_PATTERN = /cloudflare/i;
export const SITE_VERCEL_PROVIDER_PATTERN = /vercel/i;

export const SITES_CLEANUP_CONCURRENCY = 4;

export const SITE_DEPLOYMENT_SUMMARY_SURFACE_CLASS = `${TABLE_BODY_CLASS} grid gap-6 p-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]`;
export const SITE_DEPLOYMENT_LOG_SURFACE_CLASS = `${TABLE_BODY_CLASS} overflow-hidden`;

export const SITE_SETTINGS_PANEL_CLASSNAME =
  "h-[var(--collapsible-panel-height)] overflow-hidden outline-none transition-[height,opacity] duration-normal ease-emphasized motion-reduce:transition-none data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0";
/** Coalesces bursts of deployment events (enqueue, start, finish) per tab. */
export const SITES_LIVE_INVALIDATE_THROTTLE_MS = 1000;

/** Changes the unpublished strip names before the rest collapse into "N more". */
export const SITE_CHANGES_VISIBLE = 3;

// Tints sit on an opaque base because the strip sticks over scrolling content.
export const SITE_CHANGES_STRIP_TONES = {
  info: "from-info/8 to-info/8",
  warning: "from-warning/10 to-warning/10 text-warning",
  destructive: "from-destructive/10 to-destructive/10 text-destructive",
} as const;

/** Window event fired after a site goes live; the site layout answers with confetti. */
export const SITE_PUBLISHED_EVENT = "notra:site-published";
