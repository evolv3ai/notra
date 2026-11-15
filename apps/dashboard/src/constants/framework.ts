export const DASHBOARD_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-DNS-Prefetch-Control": "on",
};

// Workflow routes belong to the SDK builder. Nitro rules at those paths copy
// the entire dashboard server into the SDK's functions before it bundles them.
export const DASHBOARD_FUNCTION_RULES = {
  "/api/organizations/*/chat": { maxDuration: 1800 },
  "/api/organizations/*/dashboard-agent/chat": { maxDuration: 1800 },
  "/api/organizations/*/agent/**": { maxDuration: 800 },
};

export const WORKFLOW_ESBUILD_IDLE_STOP_MS = 5000;

export const WORKFLOW_EXTERNAL_PACKAGES = [
  "@resvg/resvg-js",
  "@cursor/sdk",
  "satori",
  "sharp",
  "wawoff2",
];

export const WORKFLOW_DEV_HANDLER_IDS = [
  "#workflow/steps.mjs",
  "#workflow/workflows.mjs",
  "#workflow/webhook.mjs",
] as const;

export const WORKFLOW_DEV_REQUIRE_BANNER =
  'import { createRequire as __notraCreateRequire } from "node:module";\nconst require = __notraCreateRequire(import.meta.url);\n';

export const WORKFLOW_DEV_OUTPUT_PATTERN = /[\\/]\.nitro[\\/]workflow[\\/]/;

export const WORKFLOW_DEV_DYNAMIC_IMPORT = "import(/* @vite-ignore */ ";

export const WORKFLOW_DEV_BUNDLE_FILES = [
  "steps.mjs",
  "workflows.mjs",
  "webhook.mjs",
] as const;

export const SOURCE_MAPPING_URL_COMMENT = /\/\/# sourceMappingURL=\S+\s*$/;

export const ORGANIZATION_COOKIE_SLUG_PATTERN = /^[a-z0-9-]+$/;

export const SERVER_ONLY_PACKAGES = [
  "@ai-sdk/anthropic",
  "@ai-sdk/code-mode",
  "@ai-sdk/devtools",
  "@ai-sdk/google",
  "@ai-sdk/mcp",
  "@ai-sdk/openai",
  "@ai-sdk/perplexity",
  "@aws-sdk/client-s3",
  "@aws-sdk/s3-request-presigner",
  "@cursor/sdk",
  "@linear/sdk",
  "@mdx-js/mdx",
  "@modelcontextprotocol/sdk",
  "@noble/hashes",
  "@octokit/core",
  "@openrouter/ai-sdk-provider",
  "@resvg/resvg-js",
  "@tinybirdco/sdk",
  "@unkey/api",
  "@upstash/box",
  "@upstash/qstash",
  "@upstash/ratelimit",
  "@upstash/redis",
  "@vercel/functions",
  "@workos-inc/node",
  "@workos/authkit-session",
  "dedent",
  "eve",
  "free-email-domains-list",
  "hast-util-from-html",
  "ipaddr.js",
  "libheif-js",
  "mailchecker",
  "nitro",
  "pg",
  "post-for-me",
  "posthog-node",
  "react-email",
  "resend",
  "sanitize-html",
  "satori",
  "satori-html",
  "sharp",
  "undici",
  "wawoff2",
  "workflow",
];

/** Pre-"Automations" pages under `/{slug}/automation/…`, redirected to it. */
export const LEGACY_AUTOMATION_PAGES: ReadonlySet<string> = new Set([
  "schedule",
  "schedules",
  "events",
]);
