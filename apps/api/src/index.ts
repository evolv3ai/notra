import "./tcc";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { flushLogs } from "@notra/ai/evlog";
import { registerDemoSocialAnalytics } from "@notra/ai/utils/demo-social";
import { createDb, db } from "@notra/db/drizzle";
import { retainDatabaseConnections } from "@notra/db/utils/retain-database-connections";
import { registerGeoDemoTraffic } from "@notra/geo-core/geo/demo-traffic";
import { shutdownPostHogServer } from "@notra/posthog/server";
import { publicStatusResponseSchema } from "@notra/schemas/api/status";
import {
  API_OPENAPI_TAGS,
  getRequiredApiScope,
  isApiMutationMethod,
  isUnscopedApiPath,
  LEGACY_API_READ_SCOPE,
  LEGACY_API_WRITE_SCOPE,
} from "@notra/utils/api-scopes";
import { ACCOUNT_API_KEY_ORGANIZATION_HEADERS } from "@notra/utils/constants/account-api-key";
import { DEMO_CONSOLE_HEADER } from "@notra/utils/constants/demo";
import { isDemoMode } from "@notra/utils/demo-mode";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { trimTrailingSlash } from "hono/trailing-slash";

import { DEMO_API_URL } from "./constants/demo";
import { API_MAX_BODY_BYTES } from "./constants/request-limits";
import { apiAnalyticsMiddleware } from "./middleware/analytics";
import { authMiddleware } from "./middleware/auth";
import { apiCompressionMiddleware } from "./middleware/compression";
import { demoRequestLogMiddleware } from "./middleware/demo-request-log";
import {
  geoContextMiddleware,
  geoProjectContextMiddleware,
} from "./middleware/geo-context";
import { geoEntitlementMiddleware } from "./middleware/geo-entitlement";
import {
  apiAuthTelemetryMiddleware,
  apiObservabilityMiddleware,
} from "./middleware/observability";
import { subscriptionMiddleware } from "./middleware/subscription";
import { agentChatsRoutes } from "./routes/agent-chats";
import { brandColorsRoutes } from "./routes/brand-colors";
import { brandIdentitiesRoutes } from "./routes/brand-identities";
import { chatsRoutes } from "./routes/chats";
import { eventTriggersRoutes } from "./routes/event-triggers";
import { feedbackRoutes } from "./routes/feedback";
import { geoAgentReadinessRoutes } from "./routes/geo-agent-readiness";
import { geoBriefsRoutes } from "./routes/geo-briefs";
import { geoCompetitorsRoutes } from "./routes/geo-competitors";
import { geoDiagnosticsRoutes } from "./routes/geo-diagnostics";
import { geoProjectsRoutes } from "./routes/geo-projects";
import { geoPromptsRoutes } from "./routes/geo-prompts";
import { geoScansRoutes } from "./routes/geo-scans";
import { geoSequencesRoutes } from "./routes/geo-sequences";
import { geoSettingsRoutes } from "./routes/geo-settings";
import { geoShelfRoutes } from "./routes/geo-shelf";
import { geoTrafficRoutes } from "./routes/geo-traffic";
import { geoVisibilityRoutes } from "./routes/geo-visibility";
import { integrationsRoutes } from "./routes/integrations";
import { legacyRedirectRoutes } from "./routes/legacy-redirects";
import { postSchedulesRoutes } from "./routes/post-schedules";
import { postsRoutes } from "./routes/posts";
import { schedulesRoutes } from "./routes/schedules";
import { skillsRoutes } from "./routes/skills";
import { webhooksRoutes } from "./routes/webhooks";
import { workspaceRoutes } from "./routes/workspaces";
import type { ApiEnv } from "./types/env";
import type { ApiServerControl } from "./types/shutdown";
import type { PublicStatusResponse } from "./types/status";
import {
  API_URL,
  AUTH_GUIDE_URL,
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
  RESOURCE_METADATA_URL,
} from "./utils/agent-discovery";
import { trackApiException } from "./utils/analytics";
import { assertDedicatedDemoDatabase } from "./utils/demo-database-guard";
import { assertRequiredEnv } from "./utils/env";
import {
  isFeedbackApiRequest,
  isPublicFeedbackIngestRequest,
} from "./utils/feedback";
import { logError } from "./utils/logging";
import { rateLimitResponse } from "./utils/openapi-responses";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "./utils/ratelimit";
import { createApiShutdown } from "./utils/shutdown";

const FRAMER_PLUGIN_ID = "8d4wmwtko6960jsu3ojmalvqm";

const FRAMER_PLUGIN_ORIGIN_PATTERN = new RegExp(
  `^https://${FRAMER_PLUGIN_ID}(-[a-zA-Z0-9]+)?\\.plugins\\.framercdn\\.com$`
);

const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const IS_DEMO = isDemoMode();

const PRODUCTION_SERVER = {
  url: "https://api.usenotra.com",
  description: "Production",
};
const DEMO_SERVER = {
  url: DEMO_API_URL,
  description:
    "Sandbox with sample data. Get a free sandbox key at demo.usenotra.com, no signup needed",
};

const publicStatusRoute = createRoute({
  method: "get",
  path: "/v1/status",
  tags: ["Discovery"],
  operationId: "getPublicApiStatus",
  summary: "Check public API reachability",
  security: [],
  responses: {
    200: {
      description:
        "Public reachability and authentication discovery metadata for agents.",
      content: {
        "application/json": {
          schema: publicStatusResponseSchema,
        },
      },
    },
    429: rateLimitResponse(
      RATE_LIMITS.publicStatus.requests,
      RATE_LIMITS.publicStatus.window,
      "IP address"
    ),
  },
});

function getAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) {
    return null;
  }

  const allowedPatterns = [
    FRAMER_PLUGIN_ORIGIN_PATTERN,
    ...(IS_PRODUCTION ? [] : [LOCAL_DEV_ORIGIN_PATTERN]),
  ];

  if (IS_DEMO && origin === process.env.NOTRA_DEMO_DASHBOARD_ORIGIN) {
    return origin;
  }

  return allowedPatterns.some((pattern) => pattern.test(origin))
    ? origin
    : null;
}

assertRequiredEnv();
retainDatabaseConnections(db.$client);

if (IS_DEMO) {
  registerGeoDemoTraffic();
  registerDemoSocialAnalytics();
  await assertDedicatedDemoDatabase(process.env.DATABASE_URL ?? "");
}

export const app = new OpenAPIHono<ApiEnv>({ strict: true });

const securityHeadersMiddleware = async (
  c: Context,
  next: () => Promise<void>
) => {
  const origin = c.req.header("origin");
  const allowedOrigin = getAllowedOrigin(origin);

  c.header("Vary", "Origin, Authorization");
  c.header("Cache-Control", "private, no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  if (allowedOrigin) {
    c.header("Access-Control-Allow-Origin", allowedOrigin);
    c.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    c.header(
      "Access-Control-Allow-Headers",
      [
        "Content-Type",
        "Authorization",
        ...ACCOUNT_API_KEY_ORGANIZATION_HEADERS,
        ...(IS_DEMO ? [DEMO_CONSOLE_HEADER] : []),
      ].join(", ")
    );
  }

  if (c.req.method === "OPTIONS") {
    return c.body(null, allowedOrigin ? 204 : 403);
  }

  await next();
};

app.use("*", apiObservabilityMiddleware);
app.use("*", apiCompressionMiddleware);
app.use("/v1/*", securityHeadersMiddleware);
app.use("/v2/*", securityHeadersMiddleware);

app.use(trimTrailingSlash({ alwaysRedirect: true }));

const databaseMiddleware = async (c: Context, next: () => Promise<void>) => {
  c.set("db", createDb(c.env.DATABASE_URL));
  await next();
};

app.use("/v1/*", databaseMiddleware);
app.use("/v2/*", databaseMiddleware);

const apiBodyLimit = bodyLimit({
  maxSize: API_MAX_BODY_BYTES,
  onError: (c) => c.json({ error: "Payload too large" }, 413),
});
app.use("/v1/*", apiBodyLimit);
app.use("/v2/*", apiBodyLimit);

if (IS_DEMO) {
  app.use("/v1/*", demoRequestLogMiddleware);
  app.use("/v2/*", demoRequestLogMiddleware);
}

app.use(
  "/v1/status",
  async (c, next) =>
    (await enforceRatelimit(c, ratelimit.publicStatus, "ip")) ?? next()
);

app.openapi(publicStatusRoute, (c) => {
  return c.json<PublicStatusResponse, 200>(
    {
      status: "ok",
      service: "Notra API",
      version: "1.0.0",
      public: true,
      authentication: {
        type: "bearer",
        resource_metadata: RESOURCE_METADATA_URL,
        guide: AUTH_GUIDE_URL,
      },
    },
    200
  );
});

const oauthScopeMiddleware = async (c: Context, next: () => Promise<void>) => {
  const pathname = new URL(c.req.url).pathname;
  const requiredScope = getRequiredApiScope(pathname, c.req.method);
  if (!requiredScope && !isUnscopedApiPath(pathname)) {
    return c.json({ error: "Not found" }, 404);
  }
  if (!requiredScope) {
    return await authMiddleware({ legacyPermissions: [] })(c, next);
  }

  const legacyPermissions = isApiMutationMethod(c.req.method)
    ? [LEGACY_API_WRITE_SCOPE]
    : [LEGACY_API_READ_SCOPE, LEGACY_API_WRITE_SCOPE];

  return await authMiddleware({
    legacyPermissions,
    permissions: requiredScope,
  })(c, next);
};

const unlessPublicFeedbackIngest =
  (middleware: (c: Context, next: () => Promise<void>) => Promise<unknown>) =>
  (c: Context, next: () => Promise<void>) =>
    isPublicFeedbackIngestRequest(new URL(c.req.url).pathname, c.req.method)
      ? next()
      : middleware(c, next);

const unlessFeedbackRequest =
  (middleware: (c: Context, next: () => Promise<void>) => Promise<unknown>) =>
  (c: Context, next: () => Promise<void>) =>
    isFeedbackApiRequest(new URL(c.req.url).pathname)
      ? next()
      : middleware(c, next);

app.use("/v1/*", apiAnalyticsMiddleware);
app.use("/v2/*", apiAnalyticsMiddleware);

app.use("/v1/*", unlessPublicFeedbackIngest(oauthScopeMiddleware));
app.use("/v2/*", oauthScopeMiddleware);
app.use("/v1/*", apiAuthTelemetryMiddleware);
app.use("/v2/*", apiAuthTelemetryMiddleware);

app.use("/v1/*", unlessFeedbackRequest(subscriptionMiddleware()));
app.use("/v2/*", subscriptionMiddleware());

const requireGeoEntitlement = geoEntitlementMiddleware();
app.use("/v1/projects/*", requireGeoEntitlement);
app.use("/v1/geo/ingest/*", requireGeoEntitlement);
app.use("/v1/projects/*", geoContextMiddleware());
app.use("/v1/projects/:projectId/*", geoProjectContextMiddleware());
app.use("/v1/geo/ingest/*", geoContextMiddleware());

// evlog-map-disable-next-line -- liveness probe
app.get("/", (c) => {
  return c.text("ok");
});

// evlog-map-disable-next-line -- liveness probe
app.get("/ping", (c) => {
  return c.text("pong");
});

// evlog-map-disable-next-line -- static OAuth metadata
app.get("/.well-known/oauth-protected-resource", (c) => {
  return c.json(buildProtectedResourceMetadata(new URL(c.req.url).origin));
});

// evlog-map-disable-next-line -- static OAuth metadata
app.get("/.well-known/oauth-authorization-server", (c) => {
  return c.json(buildAuthorizationServerMetadata());
});

// evlog-map-disable-next-line -- static API catalog
app.get("/.well-known/api-catalog", (c) => {
  c.header(
    "Content-Type",
    'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"; charset=utf-8'
  );

  return c.body(
    JSON.stringify({
      linkset: [
        {
          anchor: API_URL,
          item: [
            {
              href: `${API_URL}/openapi.json`,
              rel: "service-desc",
              type: "application/openapi+json",
              title: "Notra Public API OpenAPI schema",
            },
            {
              href: AUTH_GUIDE_URL,
              rel: "authorization-server-metadata",
              type: "text/markdown",
              title: "Notra agent authentication guide",
            },
          ],
        },
      ],
    })
  );
});

app.route("/v1", legacyRedirectRoutes);
app.route("/v1", postsRoutes);
app.route("/v1", webhooksRoutes);
app.route("/v1", postSchedulesRoutes);
app.route("/v1", brandIdentitiesRoutes);
app.route("/v1", brandColorsRoutes);
app.route("/v1", integrationsRoutes);
app.route("/v1", schedulesRoutes);
app.route("/v1", eventTriggersRoutes);
app.route("/v1", chatsRoutes);
app.route("/v1", skillsRoutes);
app.route("/v1", workspaceRoutes);
app.route("/v1", feedbackRoutes);
app.route("/v1", geoProjectsRoutes);
app.route("/v1", geoSettingsRoutes);
app.route("/v1", geoPromptsRoutes);
app.route("/v1", geoSequencesRoutes);
app.route("/v1", geoCompetitorsRoutes);
app.route("/v1", geoScansRoutes);
app.route("/v1", geoVisibilityRoutes);
app.route("/v1", geoDiagnosticsRoutes);
app.route("/v1", geoShelfRoutes);
app.route("/v1", geoBriefsRoutes);
app.route("/v1", geoAgentReadinessRoutes);
app.route("/v1", geoTrafficRoutes);
app.route("/v2", agentChatsRoutes);

app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "API Key",
  description:
    "Send your API key in the Authorization header as Bearer API_KEY. Account API keys work in every workspace you belong to: send X-Notra-Organization-Id with the workspace id or slug to choose one. Workspace endpoints require it when you belong to more than one workspace; GET /v1/me/workspaces works without it. Organization keys only accept their own workspace there.",
});

app.openAPIRegistry.registerComponent("parameters", "OrganizationSelector", {
  name: "X-Notra-Organization-Id",
  in: "header",
  required: false,
  description:
    "Workspace id or slug an account API key acts on. Required on workspace endpoints when the key's user belongs to more than one workspace; GET /v1/me/workspaces works without it. Organization keys reject any other workspace; OAuth tokens ignore it.",
  schema: { type: "string" },
});

let openApiJson: string | undefined;
// evlog-map-disable-next-line -- static OpenAPI document
app.get("/openapi.json", (c) => {
  openApiJson ??= JSON.stringify(
    app.getOpenAPI31Document({
      openapi: "3.1.1",
      info: {
        title: "Notra API",
        version: "1.0.0",
        description:
          "OpenAPI schema for Notra content endpoints. Use GET /v1/status for public reachability. Error responses include recovery guidance. Breaking changes ship under a new major path; deprecated operations send Deprecation and Sunset headers at least 90 days before removal.",
      },
      externalDocs: {
        description: "Notra API versioning and deprecation policy",
        url: "https://www.usenotra.com/docs/api/versioning",
      },
      servers: IS_DEMO
        ? [DEMO_SERVER, PRODUCTION_SERVER]
        : [PRODUCTION_SERVER, DEMO_SERVER],
      security: [{ BearerAuth: [] }],
      tags: [...API_OPENAPI_TAGS],
    })
  );
  c.header("Content-Type", "application/json");
  return c.body(openApiJson);
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  const { pathname } = new URL(c.req.url);
  logError(`Unhandled error: ${c.req.method} ${pathname}`, error);
  trackApiException(c, error, 500);
  return c.json({ error: "Internal server error" }, 500);
});

const apiShutdown = createApiShutdown(() =>
  Promise.allSettled([shutdownPostHogServer(), flushLogs()])
);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void apiShutdown.shutdown().finally(() => process.exit(0));
  });
}

export default {
  port: process.env.PORT ?? 3000,
  // Bun closes a connection after 10s without bytes on the socket, and an
  // in-flight handler that has not written a response yet counts as idle. That
  // default silently killed the synchronous GEO sequence run — the socket shut
  // after ~10s with zero bytes sent. 255s is Bun's maximum; the synchronous
  // internal call gives up at 240s (see SYNCHRONOUS_INTERNAL_CALL_TIMEOUT_MS)
  // so the client always gets a real answer first. Not 0/disabled: a wedged
  // upstream should not hold sockets forever.
  idleTimeout: 255,
  fetch: (request: Request, server: ApiServerControl) => {
    apiShutdown.attachServer(server);
    return apiShutdown.handleRequest(() => app.fetch(request, process.env));
  },
};
