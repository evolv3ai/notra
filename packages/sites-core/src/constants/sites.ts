import {
  SITE_CHROME_FILES,
  SITE_SLOTS_DIR,
} from "@notra/sites-core/constants/site-layout";
import type { SiteDeploymentStatus } from "@notra/sites-core/types/sites";

export const SITE_AREAS = ["blog", "changelog"] as const;

export const SITE_CONFIG_FILENAME = "blog.json";
export const SITE_CONFIG_SCHEMA_URL = "https://usenotra.com/schemas/blog.json";

export const SITE_ASSETS_DIR = "_notra/assets";

export const SITE_PREVIEW_HOST_SEPARATOR = "--";
export const SITE_PREVIEW_KEY_MAX_LENGTH = 40;
export const SITE_SLUG_MIN_LENGTH = 3;
export const SITE_SLUG_MAX_LENGTH = 40;
export const DNS_LABEL_MAX_LENGTH = 63;
export const DNS_HOSTNAME_MAX_LENGTH = 253;
export const SITE_RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "assets",
  "cdn",
  "docs",
  "mail",
  "notra",
  "preview",
  "previews",
  "static",
  "status",
]);
/**
 * Blocked for new sites only. Host parsing keeps using SITE_RESERVED_SLUGS so
 * a live site that already has one of these addresses keeps resolving.
 */
export const SITE_UNAVAILABLE_SLUGS = new Set([
  "abuse",
  "account",
  "accounts",
  "administrator",
  "auth",
  "autoconfig",
  "autodiscover",
  "billing",
  "checkout",
  "cname",
  "console",
  "dashboard",
  "dns",
  "email",
  "fallback",
  "ftp",
  "gateway",
  "help",
  "hostmaster",
  "identity",
  "imap",
  "ingest",
  "internal",
  "intranet",
  "invoice",
  "invoices",
  "localhost",
  "login",
  "logout",
  "mta-sts",
  "no-reply",
  "noreply",
  "ns1",
  "ns2",
  "oauth",
  "oauth2",
  "origin",
  "password",
  "pay",
  "payment",
  "payments",
  "pop3",
  "portal",
  "postmaster",
  "recovery",
  "register",
  "reset",
  "root",
  "secure",
  "security",
  "sftp",
  "signin",
  "signout",
  "signup",
  "sites",
  "smtp",
  "sso",
  "staging",
  "support",
  "verify",
  "vpn",
  "wallet",
  "webmail",
  "webmaster",
]);
export const SITE_MOUNT_MAX_SEGMENTS = 3;
export const SITE_MAX_REMOVED_PREVIEWS = 200;

export const SITE_PREVIEW_COOKIE = "__notra_preview";
export const SITE_PREVIEW_AUTH_PATH = "/_notra/auth";
export const SITE_PREVIEW_SESSION_SECONDS = 60 * 60 * 12;
export const SITE_PREVIEW_MEMBER_SESSION_SECONDS = 60 * 60;
export const SITE_PREVIEW_MEMBER_RENEW_SECONDS = 60 * 60 * 24 * 7;
export const SITE_PREVIEW_SHARE_LINK_SECONDS = 60 * 60 * 24 * 7;
/** How long a post preview may stay open, chosen in the post's Preview tab. */
export const POST_PREVIEW_LIFETIMES = {
  "1h": 60 * 60,
  "1d": 60 * 60 * 24,
  "3d": 60 * 60 * 24 * 3,
  "7d": 60 * 60 * 24 * 7,
} as const;
export const SITE_PREVIEW_SIGN_OUT_PATH = "/_notra/auth/sign-out";

export const SITE_PREVIEW_PASSWORD_ALGORITHM = "PBKDF2-SHA256";
export const SITE_PREVIEW_PASSWORD_ITERATIONS = 100_000;
export const SITE_PREVIEW_PASSWORD_SALT_BYTES = 16;
export const SITE_PREVIEW_PASSWORD_HASH_BYTES = 32;
export const SITE_PREVIEW_PASSWORD_MIN_LENGTH = 8;
export const SITE_PREVIEW_PASSWORD_MAX_LENGTH = 128;

export const SITE_BUILD_LIMITS = {
  buildTimeoutSeconds: 10 * 60,
  maxOutputBytes: 500 * 1024 * 1024,
  maxOutputFiles: 20_000,
  maxSingleFileBytes: 25 * 1024 * 1024,
  maxSourceBytes: 200 * 1024 * 1024,
  maxSourceFiles: 10_000,
  maxBuildLogBytes: 512 * 1024,
  maxConcurrentBuilds: 20,
  maxConcurrentBuildsPerSite: 2,
  maxDeploymentsPerOrganizationPerDay: 300,
} as const;

export const SITE_SOURCE_ROOT_ENTRIES = [
  SITE_CONFIG_FILENAME,
  "blog",
  "changelog",
  "snippets",
  "public",
  "style.css",
  "styles",
  "script.js",
  "scripts",
  ...SITE_CHROME_FILES,
  SITE_SLOTS_DIR,
] as const;
export const SITE_SOURCE_ROOTS: ReadonlySet<string> = new Set(
  SITE_SOURCE_ROOT_ENTRIES
);

export const SITE_CUSTOM_SCRIPT_FILENAME = "script.js";
export const SITE_CUSTOM_SCRIPTS_DIR = "scripts";

export const SITE_SOURCE_EXTENSIONS = [
  ".md",
  ".mdx",
  ".jsx",
  ".js",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
  ".mp4",
  ".webm",
  ".pdf",
  ".txt",
  ".woff",
  ".woff2",
  ".css",
  ".riv",
  ".wasm",
] as const;

export const SITE_INJECTED_REACT_HOOKS = [
  "useState",
  "useEffect",
  "useRef",
  "useCallback",
  "useMemo",
  "useContext",
  "useReducer",
  "useId",
  "useLayoutEffect",
  "useTransition",
  "useDeferredValue",
] as const;

export const SITE_DEPLOYMENT_KINDS = ["production", "preview"] as const;

export const SITE_DEPLOYMENT_STATUSES = [
  "queued",
  "building",
  "uploading",
  "ready",
  "superseded",
  "skipped",
  "failed",
  "canceled",
  "expired",
] as const;

export const SITE_DEPLOYMENT_TRANSITIONS: Record<
  SiteDeploymentStatus,
  readonly SiteDeploymentStatus[]
> = {
  queued: [],
  building: ["queued", "building", "uploading"],
  uploading: ["building", "uploading"],
  ready: ["uploading"],
  superseded: ["queued", "building", "uploading"],
  skipped: ["queued"],
  failed: ["queued", "building", "uploading"],
  canceled: ["queued", "building", "uploading"],
  expired: ["ready"],
};

export const SITE_DEPLOYMENT_IN_PROGRESS_STATUSES = [
  "queued",
  "building",
  "uploading",
] as const;

export const SITE_DEPLOYMENT_TRIGGERS = [
  "push",
  "pull_request",
  "manual",
  "redeploy",
  "config",
] as const;

export const SITE_PREVIEW_VISIBILITIES = ["public", "protected"] as const;
export const SITE_STATUSES = ["active", "suspended"] as const;
export const SITE_SUSPENDERS = ["owner", "notra"] as const;
export const SITE_ABUSE_EMAIL = "abuse@usenotra.com";
/** Dialogs a console deep link (e.g. from the Slack info channel) opens. */
export const SITE_CONSOLE_ACTIONS = [
  "suspend-site",
  "suspend-workspace",
  "ban-owner",
] as const;
export const SITE_SUSPENSION_CATEGORIES = [
  "phishing",
  "malware",
  "deceptive_redirects",
  "spam",
  "terms",
] as const;
/** Neutral wording shown to visitors on the 410 page and in owner emails. */
export const SITE_SUSPENSION_CATEGORY_LABELS = {
  phishing: "Phishing or credential harvesting",
  malware: "Malware or unwanted software",
  deceptive_redirects: "Deceptive redirects",
  spam: "Spam or scams",
  terms: "Terms of Service violation",
} as const satisfies Record<
  (typeof SITE_SUSPENSION_CATEGORIES)[number],
  string
>;
export const SITE_DOMAIN_KINDS = ["subdomain", "proxy"] as const;
export const SITE_DOMAIN_STATUSES = [
  "pending",
  "verifying",
  "active",
  "failed",
] as const;

export const SITE_R2_KEYS = {
  host: (hostname: string) => `hosts/${hostname}.json`,
  state: (siteId: string) => `sites/${siteId}/state.json`,
  deploymentPrefix: (siteId: string, deploymentId: string) =>
    `deployments/${siteId}/${deploymentId}/`,
  manifest: (siteId: string, deploymentId: string) =>
    `deployments/${siteId}/${deploymentId}/manifest.json`,
  file: (siteId: string, deploymentId: string, path: string) =>
    `deployments/${siteId}/${deploymentId}/files${path}`,
  buildLog: (siteId: string, deploymentId: string) =>
    `logs/${siteId}/${deploymentId}.log`,
  /** Files a post preview adds on top of the production source. */
  previewSource: (siteId: string, previewKey: string) =>
    `previews/${siteId}/${previewKey}/source.json`,
} as const;

/** Files below each mount that the worker answers for the analytics script. */
export const SITE_ANALYTICS_SCRIPT_FILE = "_notra/insights.js";
export const SITE_ANALYTICS_EVENT_FILE = "_notra/e";
/** Below each mount, `<dir>/<host>` answers with that host's favicon. */
export const SITE_FAVICON_DIR = "_notra/favicon";
/** Lowercase ASCII hostnames; `new URL()` already punycodes the rest. */
export const SITE_FAVICON_HOST = /^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
/** Longer visible times are capped: a tab left open overnight is not reading. */
export const SITE_ENGAGEMENT_MAX_VISIBLE_MS = 30 * 60 * 1000;
export const SITE_ENGAGEMENT_VIEW_ID_PATTERN = /^[a-z0-9]{16,32}$/;
export const SITES_LIVE_CHANNEL_PREFIX = "sites";

export const NOTRA_BRANCH_PREFIX = "notra/";

export const SITE_EDIT_BRANCH_PREFIX = "notra/site-edit-";
