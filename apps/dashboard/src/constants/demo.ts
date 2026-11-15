export const DEMO_SESSION_COOKIE = "notra_demo";
export const DEMO_BANNER_PARAM = "banner";
export const DEMO_BANNER_COOKIE = "notra_demo_banner";
export const DEMO_BANNER_OFF = "off";
export const DEMO_BANNER_ON = "on";
export const DEMO_THEME_PARAM = "theme";
export const DEMO_THEME_MESSAGE = "notra:demo-theme";
export const DEMO_READY_MESSAGE = "notra:demo-ready";
export const DEMO_THEMES = ["light", "dark"] as const;
export const DEMO_FRAME_ANCESTOR = "https://www.usenotra.com";
export const DEMO_LOCAL_FRAME_ANCESTOR = "http://localhost:*";
export const DEMO_LOCAL_FRAME_ORIGIN = /^http:\/\/localhost(?::\d+)?$/;
export const DEMO_EMBED_COOKIE_ATTRIBUTES = {
  sameSite: "none",
  secure: true,
  partitioned: true,
} as const;

const HOUR_MS = 60 * 60 * 1000;

export const DEMO_SANDBOX_MAX_AGE_MS = 6 * HOUR_MS;
export const DEMO_SESSION_COOKIE_MAX_AGE_SECONDS =
  DEMO_SANDBOX_MAX_AGE_MS / 1000;
export const DEMO_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const DEMO_ANONYMOUS_ID_PREFIX = "anon_";
export const DEMO_ANONYMOUS_ID_PATTERN = /^anon_[A-Za-z0-9_-]{16}$/;
export const DEMO_ANONYMOUS_ID_LENGTH = 16;

export const DEMO_POOL_ID_PREFIX = "pool_";
export const DEMO_SEED_ID_PREFIX = "seed_";
export const DEMO_STORAGE_LOCK_KEY = "notra:demo-storage";
export const DEMO_DEFAULT_POOL_SIZE = 3;
export const DEMO_POOL_FRESH_MS = 2 * 60 * 60 * 1000;
export const DEMO_POOL_REFILL_LOCK_KEY = "demo:pool-refill";
export const DEMO_POOL_REFILL_LOCK_SECONDS = 120;
export const DEMO_POOL_REFILL_RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;
export const DEMO_HOME_SECTION = "/geo";
export const DEMO_ENTER_PATH = "/api/demo/enter";

export const DEMO_SANDBOX_CREATE_LIMIT = 30;
export const DEMO_SANDBOX_CREATE_WINDOW = "1 h";
export const DEMO_SANDBOX_RESET_LIMIT = 3;
export const DEMO_SANDBOX_RESET_WINDOW = "1 m";
export const DEMO_SANDBOX_RESET_LOCK_PREFIX = "demo:sandbox-reset:";
export const DEMO_SANDBOX_RESET_LOCK_SECONDS = 120;
export const DEMO_SANDBOX_TIME_ZONE_LIMIT = 5;
export const DEMO_SANDBOX_TIME_ZONE_WINDOW = "1 h";

export const DEMO_START_PATH = "/auth/demo";
export const DEMO_SIGNUP_URL = "https://app.usenotra.com/signup";

export const DEMO_API_KEY_PREFIX = "notra_demo";
export const DEMO_API_KEY_RATE_LIMIT = { limit: 60, durationMs: 60_000 };

export const DEMO_USER_EMAIL_DOMAIN = "fieldnote.example";
export const DEMO_VISITOR_EMAIL_LOCAL = "you";
export const DEMO_VISITOR_NAME = "Demo Visitor";
export const DEMO_COMPANY_NAME = "Fieldnote";
export const DEMO_COMPANY_DOMAIN = "fieldnote.example";
export const DEMO_COMPANY_HANDLE = "fieldnote";

export const DEMO_CLEANUP_BATCH_SIZE = 50;

export const DEMO_REBASE_EXCLUDED_TABLES: ReadonlySet<string> = new Set([
  "demo_sandboxes",
]);

export const DEMO_SIGNUP_PATH = /^\/signup(?:\/|$)/;
export const DEMO_AUTH_PATH =
  /^\/(?:login|forgot-password|reset-password|callback|auth\/(?:callback|initiate|social|external))(?:\/|$)/;
export const DEMO_ONBOARDING_PATH = /^\/onboarding(?:\/|$)/;
export const DEMO_HIDDEN_PAGE_PATH = /^\/([^/]+)\/geo\/directions(?:\/|$)/;

export const DEMO_ORG_SLUG_PATH = /^\/demo-[a-z0-9]+((?:[/?#].*)?)$/;
export const DEMO_ORG_SLUG_SUFFIX_LENGTH = 8;

export const DEMO_BILLING_PLAN = {
  id: "growth",
  name: "Growth",
  periodElapsedDays: 18,
} as const;
export const DEMO_BILLING_PERIOD_DAYS = 30;
export const DEMO_BILLING_CREDITS = { granted: 5000, used: 2140 } as const;
export const DEMO_REQUEST_FEED_LIMIT = 100;

export const DEMO_BANNER_HEIGHT = "2.75rem";

export const DEMO_DISABLED_MESSAGE =
  "This is not available in the demo. Start free to use it with your own workspace.";
export const DEMO_EXIT_URL = "https://www.usenotra.com";

export const DEMO_BLOCKED_PATH =
  /^\/(?:api\/integrations\/[^/]+\/(?:authorize|callback|install)|api\/integrations\/mcp\/oauth|connect\/|api\/social-accounts\/)/;

export const DEMO_BLOCKED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not available in the demo</title><style>body{font:15px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;color:#1a1d1f;background:#fafafa}main{max-width:26rem;text-align:center}a,button{font:inherit;border:0;border-radius:8px;padding:8px 14px;margin:4px;cursor:pointer}a{background:#7c5cfc;color:#fff;text-decoration:none}button{background:#eee}</style></head><body><main><h1 style="font-size:18px">Connecting accounts is off in the demo</h1><p>The demo uses sample integrations so nothing leaves this sandbox. Start free to connect your own GitHub, Slack, Linear and more.</p><a href="${DEMO_SIGNUP_URL}" rel="noopener" target="_top">Start free</a><button onclick="window.opener?window.close():history.back()">Go back</button></main></body></html>`;

export const DEMO_MAX_ACTIVE_SANDBOXES = 50;
export const DEMO_EVICTION_IDLE_MS = 15 * 60 * 1000;

export const DEMO_PERSONALIZATION_NAME_MAX = 40;
export const DEMO_PERSONALIZATION_COMPANY_MAX = 60;
