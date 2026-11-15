import {
  C15T_ACTION_DIRECTIONS,
  C15T_BAR_POSITIONS,
  C15T_COLOR_TOKENS,
  C15T_FLOATING_POSITIONS,
  C15T_LOCALES,
  C15T_RADII,
  C15T_SCRIPT_CATEGORIES,
  C15T_SCRIPT_PATH,
  C15T_STORAGE_MAX_EXPIRY_DAYS,
  C15T_UI_PROFILES,
  C15T_WIDGET_POSITIONS,
  CSP_ORIGIN,
  DATABUDDY_CLIENT_ID,
  DATABUDDY_CLIENT_ID_MESSAGE,
  DATABUDDY_MAX_BATCH_SIZE,
  DATABUDDY_MAX_DELAY_MS,
  DATABUDDY_MAX_PATH_PATTERNS,
  DATABUDDY_MAX_RETRIES,
  DATABUDDY_PATH_PATTERN,
  GA4_MEASUREMENT_ID,
  HOSTNAME,
  HOSTNAME_WITH_PORT,
  HTTPS_BASE_URL,
  HTTPS_SCRIPT_URL,
  POSTHOG_API_KEY,
  TRAILING_SLASHES,
} from "@notra/sites-core/constants/integrations";
import { SITE_CSP_MAX_ALLOWED_ORIGINS } from "@notra/sites-core/constants/security";
import {
  SITE_HEX_COLOR,
  SITE_LINK_HREF,
} from "@notra/sites-core/constants/site-config";
import type { DatabuddySchemaShape } from "@notra/sites-core/types/site-integrations";
import { z } from "zod";

const httpsScriptUrlSchema = z
  .string()
  .trim()
  .regex(
    HTTPS_SCRIPT_URL,
    "Use the full https:// script URL including its path, without query or hash"
  )
  .optional();

const httpsBaseUrlSchema = z
  .string()
  .trim()
  .regex(HTTPS_BASE_URL, "Use an https:// URL without query or hash")
  .overwrite((value) => value.replace(TRAILING_SLASHES, ""))
  .optional();

const optionalBooleanSchema = z.boolean().optional();

const ga4Schema = z.strictObject({
  measurementId: z
    .string({ error: "Use the measurement ID (G-…)" })
    .trim()
    .regex(GA4_MEASUREMENT_ID, "Use the measurement ID (G-…)")
    .describe(
      "Google Analytics 4 web stream Measurement ID (G-…). Find it in Admin > Data streams > your web stream."
    ),
});

const plausibleSchema = z.strictObject({
  domain: z
    .string({ error: "Use the domain as added in Plausible, e.g. acme.com" })
    .trim()
    .toLowerCase()
    .regex(HOSTNAME, "Use the domain as added in Plausible, e.g. acme.com")
    .describe(
      "Site domain registered in Plausible, without https:// (e.g. docs.acme.com)."
    ),
  server: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      HOSTNAME_WITH_PORT,
      "Use a hostname with an optional port, without https://, e.g. plausible.acme.com:8443"
    )
    .optional()
    .describe(
      "Self-hosted Plausible hostname with an optional port, without https://. Omit to use plausible.io."
    ),
});

const posthogSchema = z.strictObject({
  apiKey: z
    .string({ error: "Use the project API key (phc_…)" })
    .trim()
    .regex(POSTHOG_API_KEY, "Use the project API key (phc_…)")
    .describe(
      "Public PostHog project API key (phc_…), not a personal API key."
    ),
  apiHost: httpsBaseUrlSchema.describe(
    "PostHog ingestion URL. Defaults to https://us.i.posthog.com; use https://eu.i.posthog.com for EU Cloud or your self-hosted HTTPS endpoint."
  ),
  sessionRecording: optionalBooleanSchema.describe(
    "Enable session recording (default: true). Authorize your site domain in PostHog project settings. Set false to keep analytics without recordings."
  ),
});

const umamiSchema = z.strictObject({
  websiteId: z
    .string({ error: "Copy the Website ID from Umami's tracking code" })
    .trim()
    .uuid("Copy the Website ID from Umami's tracking code")
    .describe(
      "Public Umami Website ID (UUID) from your website's Tracking code. No API key is needed."
    ),
  scriptUrl: httpsScriptUrlSchema.describe(
    "Tracker script URL including a non-root path. Defaults to https://cloud.umami.is/script.js; use your self-hosted HTTPS script URL when needed."
  ),
  hostUrl: httpsBaseUrlSchema.describe(
    "Optional collection endpoint base URL (data-host-url). Only needed when events should go to a different endpoint, such as a reverse proxy."
  ),
});

const c15tSurfaceSchema = {
  direction: z
    .enum(C15T_ACTION_DIRECTIONS)
    .optional()
    .describe("Lay the buttons out in a row (default) or a column."),
  uiProfile: z
    .enum(C15T_UI_PROFILES)
    .optional()
    .describe(
      "compact (default) sizes buttons to their labels; balanced and strict stretch every button to full width."
    ),
};

const c15tPromptSchema = z
  .discriminatedUnion("variant", [
    z.strictObject({
      variant: z.literal("floating"),
      position: z.enum(C15T_FLOATING_POSITIONS).optional(),
      blocking: z.boolean().optional(),
      ...c15tSurfaceSchema,
    }),
    z.strictObject({
      variant: z.literal("bar"),
      position: z.enum(C15T_BAR_POSITIONS).optional(),
      blocking: z.boolean().optional(),
      ...c15tSurfaceSchema,
    }),
    z.strictObject({
      variant: z.literal("widget"),
      position: z.enum(C15T_WIDGET_POSITIONS).optional(),
      blocking: z.boolean().optional(),
      ...c15tSurfaceSchema,
    }),
    z.strictObject({ variant: z.literal("wall"), ...c15tSurfaceSchema }),
  ])
  .describe(
    "Shape and position of the consent banner. floating is a card, bar spans the viewport edge, widget is a compact corner card, wall blocks the page until the visitor chooses."
  );

const c15tLegalLinkSchema = z.strictObject({
  href: z
    .string()
    .trim()
    .regex(SITE_LINK_HREF, "Use an absolute https:// URL or a path"),
  label: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional()
    .describe("Link text. Defaults to the translated name of the link."),
});

const c15tColorsSchema = z.partialRecord(
  z.enum(C15T_COLOR_TOKENS),
  z.string().regex(SITE_HEX_COLOR, "Use a hex color like #8B5CF6")
);

export const c15tSchema = z
  .strictObject({
    backendURL: z
      .string({
        error:
          "Use your Inth project URL or self-hosted c15t backend, e.g. https://acme.inth.app",
      })
      .trim()
      .regex(HTTPS_BASE_URL, "Use an https:// URL without query or hash")
      .overwrite((value) => value.replace(/\/+$/, ""))
      .describe(
        "Your Inth project URL (https://your-project.inth.app) or the URL of your self-hosted c15t backend, including any path prefix. Visitors save consent there."
      ),
    scripts: z
      .record(
        z
          .string()
          .regex(
            C15T_SCRIPT_PATH,
            "Use the script's path in your repository, like scripts/hotjar.js"
          ),
        z.enum(C15T_SCRIPT_CATEGORIES)
      )
      .optional()
      .describe(
        'Custom scripts that load only after the visitor allows a category, keyed by their path, like { "scripts/hotjar.js": "measurement" }. Scripts you leave out load on every page.'
      ),
    prompt: c15tPromptSchema.optional(),
    preferences: z
      .strictObject({
        blocking: z
          .boolean()
          .optional()
          .describe("Dim the page and trap focus while open (default: true)."),
        ...c15tSurfaceSchema,
      })
      .optional()
      .describe("Layout of the privacy settings dialog."),
    legalLinks: z
      .strictObject({
        privacyPolicy: c15tLegalLinkSchema.optional(),
        cookiePolicy: c15tLegalLinkSchema.optional(),
        termsOfService: c15tLegalLinkSchema.optional(),
      })
      .optional()
      .describe("Legal pages linked from the banner and the dialog."),
    locale: z
      .enum(C15T_LOCALES)
      .optional()
      .describe(
        "Force the banner language. Omit to follow the visitor's browser language."
      ),
    crossSubdomain: z
      .boolean()
      .optional()
      .describe(
        "Share the consent cookie with every subdomain of the site's domain (default: false)."
      ),
    expiryDays: z
      .number()
      .int()
      .min(1)
      .max(C15T_STORAGE_MAX_EXPIRY_DAYS)
      .optional()
      .describe("Days until the stored choice expires (default: 365)."),
    disableAnimation: z
      .boolean()
      .optional()
      .describe("Show the banner and dialog without animations."),
    theme: z
      .strictObject({
        colors: c15tColorsSchema
          .optional()
          .describe(
            "Light mode colors as hex values. Unset colors follow your site's theme."
          ),
        dark: c15tColorsSchema
          .optional()
          .describe(
            "Dark mode colors as hex values. Unset colors follow your site's dark theme."
          ),
        radius: z
          .enum(C15T_RADII)
          .optional()
          .describe(
            "Corner rounding of the banner, dialog and buttons (default: medium)."
          ),
      })
      .optional()
      .describe(
        "Banner and dialog styling. By default they use your site's colors, fonts and dark mode."
      ),
    hideBranding: z
      .boolean()
      .optional()
      .describe(
        "Hide the 'Secured by c15t' badge on the banner. Check that your Inth plan allows it."
      ),
    devTools: z
      .boolean()
      .default(true)
      .describe(
        "Show the c15t DevTools panel during local development with notra-sites dev (default: true). Never included in previews or the live site."
      ),
  })
  .describe(
    "c15t cookie banner and privacy settings, backed by Inth or your self-hosted c15t backend. Live deployments only; previews and local development show the banner without saving consent."
  );
const databuddyPathPatternsSchema = z
  .array(
    z
      .string()
      .trim()
      .regex(
        DATABUDDY_PATH_PATTERN,
        "Use a path glob starting with /, e.g. /changelog/*"
      )
  )
  .max(DATABUDDY_MAX_PATH_PATTERNS);

const databuddyDelaySchema = z
  .number()
  .int()
  .min(0)
  .max(DATABUDDY_MAX_DELAY_MS);

const databuddySchema = z.strictObject({
  clientId: z
    .string({ error: DATABUDDY_CLIENT_ID_MESSAGE })
    .trim()
    .regex(DATABUDDY_CLIENT_ID, DATABUDDY_CLIENT_ID_MESSAGE)
    .describe(
      "Public Databuddy Client ID from your website's tracking code (data-client-id). No API key is needed."
    ),
  scriptUrl: httpsScriptUrlSchema.describe(
    "Tracker script URL. Defaults to https://cdn.databuddy.cc/databuddy.js; set it for a self-hosted or proxied script."
  ),
  apiUrl: httpsBaseUrlSchema.describe(
    "Event ingestion URL. Defaults to https://basket.databuddy.cc; set it for a self-hosted or proxied endpoint."
  ),
  trackWebVitals: optionalBooleanSchema.describe(
    "Send Core Web Vitals (LCP, CLS, INP, FCP, TTFB) for each page (default: false)."
  ),
  trackErrors: optionalBooleanSchema.describe(
    "Send uncaught JavaScript errors (default: false)."
  ),
  trackOutgoingLinks: optionalBooleanSchema.describe(
    "Send an event when visitors click links to other domains (default: false)."
  ),
  trackInteractions: optionalBooleanSchema.describe(
    "Send clicks, rage clicks and dead clicks (default: false)."
  ),
  trackAttributes: optionalBooleanSchema.describe(
    "Send a custom event when visitors click elements with a data-track attribute, using other data-* attributes as properties (default: false)."
  ),
  trackHashChanges: optionalBooleanSchema.describe(
    "Count URL hash changes as page views (default: false)."
  ),
  samplingRate: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Share of events to send, from 0 to 1 (default: 1)."),
  skipPatterns: databuddyPathPatternsSchema
    .optional()
    .describe('Path globs that are never tracked, e.g. ["/drafts/**"].'),
  maskPatterns: databuddyPathPatternsSchema
    .optional()
    .describe(
      'Path globs whose matching segments are masked before sending, e.g. ["/authors/*"].'
    ),
  anonymizeVisitorIds: z
    .union([z.boolean(), z.literal("auto")])
    .optional()
    .describe(
      'Anonymize visitor IDs before storage, or "auto" to let Databuddy decide (default: true).'
    ),
  ignoreBotDetection: optionalBooleanSchema.describe(
    "Also track visits that look like bots (default: false)."
  ),
  usePixel: optionalBooleanSchema.describe(
    "Send events with a 1x1 image request instead of fetch (default: false)."
  ),
  enableBatching: optionalBooleanSchema.describe(
    "Send events in batches (default: true)."
  ),
  batchSize: z
    .number()
    .int()
    .min(1)
    .max(DATABUDDY_MAX_BATCH_SIZE)
    .optional()
    .describe("Events per batch, from 1 to 50 (default: 10)."),
  batchTimeout: databuddyDelaySchema
    .optional()
    .describe("Milliseconds before a partial batch is sent (default: 5000)."),
  enableRetries: optionalBooleanSchema.describe(
    "Retry failed requests (default: true)."
  ),
  maxRetries: z
    .number()
    .int()
    .min(0)
    .max(DATABUDDY_MAX_RETRIES)
    .optional()
    .describe("Retries per failed request (default: 3)."),
  initialRetryDelay: databuddyDelaySchema
    .optional()
    .describe("Milliseconds before the first retry (default: 500)."),
  replay: z
    .union([
      z.boolean(),
      z.strictObject({
        maskText: optionalBooleanSchema.describe(
          "Mask page text in recordings (default: true). Set false only on pages that show no personal data; typed input stays masked."
        ),
        recordIframes: optionalBooleanSchema.describe(
          "Record your own embedded pages into the parent page's recording. Set it on the framed page too (default: false)."
        ),
        scriptUrl: httpsScriptUrlSchema.describe(
          "Recorder script URL. Defaults to https://cdn.databuddy.cc/replay.js; set it for a self-hosted or proxied script."
        ),
      }),
    ])
    .optional()
    .describe(
      "Record session replays with Databuddy's recorder (default: false). Turn session replay on for the website in Databuddy too."
    ),
} satisfies DatabuddySchemaShape);

export const siteIntegrationSchemas = {
  databuddy: databuddySchema,
  ga4: ga4Schema,
  plausible: plausibleSchema,
  posthog: posthogSchema,
  umami: umamiSchema,
};

export const siteIntegrationUpdateSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("databuddy"),
    settings: databuddySchema.nullable(),
  }),
  z.object({ provider: z.literal("ga4"), settings: ga4Schema.nullable() }),
  z.object({
    provider: z.literal("umami"),
    settings: umamiSchema.nullable(),
  }),
  z.object({
    provider: z.literal("plausible"),
    settings: plausibleSchema.nullable(),
  }),
  z.object({
    provider: z.literal("posthog"),
    settings: posthogSchema.nullable(),
  }),
]);

export const siteIntegrationsSchema = z
  .strictObject({
    databuddy: databuddySchema.optional(),
    ga4: ga4Schema.optional(),
    plausible: plausibleSchema.optional(),
    posthog: posthogSchema.optional(),
    umami: umamiSchema.optional(),
    c15t: c15tSchema.optional(),
  })
  .default({})
  .describe(
    "Analytics providers and the c15t consent banner for the live site. Notra installs their scripts automatically. Preview deployments and local development do not send provider events."
  );

export const siteSecuritySchema = z
  .strictObject({
    contentSecurityPolicy: z.boolean().default(true),
    allowedOrigins: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            CSP_ORIGIN,
            "Use an origin like https://cdn.example.com (no path), optionally https://*.example.com"
          )
      )
      .max(SITE_CSP_MAX_ALLOWED_ORIGINS)
      .default([]),
    webAssembly: z
      .boolean()
      .default(false)
      .describe(
        "Let scripts compile WebAssembly, for runtimes like Rive or Lottie. Adds 'wasm-unsafe-eval' to script-src; JavaScript eval stays blocked."
      ),
  })
  .default({
    contentSecurityPolicy: true,
    allowedOrigins: [],
    webAssembly: false,
  });
