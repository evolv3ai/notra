import { createRoute } from "@hono/zod-openapi";
import {
  startGeoPromptRescan,
  startGeoScan,
} from "@notra/geo-core/geo/programs";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  projectParamsSchema,
  promptParamsSchema,
  scanParamsSchema,
} from "@notra/schemas/api/geo-params";
import {
  createScanResponseSchema,
  listScansQuerySchema,
  listScansResponseSchema,
  scanResponseSchema,
} from "@notra/schemas/api/geo-scans";
import type { Context } from "hono";

import { API_TRIGGER_SOURCE } from "../constants/analytics";
import {
  GEO_COMMON_ERROR_RESPONSES,
  GEO_OPENAPI_TAG,
} from "../constants/geo-openapi";
import { getGeoScanForProject, listGeoScansForProject } from "../programs/geo";
import { runGeoEffect } from "../runtime/geo";
import type { ApiEnv } from "../types/env";
import type { GeoOutcome } from "../types/geo";
import { trackApiEvent } from "../utils/analytics";
import {
  attachGeoOrganization,
  geoErrorResponse,
  geoOutcomeResponse,
} from "../utils/geo";
import { createOpenApiApp } from "../utils/openapi-app";
import { rateLimitResponse } from "../utils/openapi-responses";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "../utils/ratelimit";

export const geoScansRoutes = createOpenApiApp();

const createScanRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/scans",
  tags: [GEO_OPENAPI_TAG],
  operationId: "createGeoScan",
  summary: "Trigger a GEO scan",
  description:
    "Queues a scan with the Notra dashboard, which owns the model credentials and billing gates. The public API never calls an answer engine itself. The scan record is created before the hand-off, so `scanId` is immediately readable via `GET /v1/projects/{projectId}/geo/scans/{scanId}`. Poll `statusUrl` (also returned as the `Location` header) until `status` leaves `running`. Returns 409 while a scan for this project is still in flight, and 402 when the plan or AI credits cannot cover a scan.",
  request: { params: projectParamsSchema },
  responses: {
    202: {
      description: "Scan accepted",
      headers: {
        Location: {
          description: "Relative path of the scan created for this trigger.",
          schema: { type: "string" as const },
        },
      },
      content: { "application/json": { schema: createScanResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    429: rateLimitResponse(
      RATE_LIMITS.scanTrigger.requests,
      RATE_LIMITS.scanTrigger.window
    ),
  },
});

const createPromptScanRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/scans/prompts/{promptId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "createGeoPromptScan",
  summary: "Rescan a single GEO prompt",
  description:
    "Queues a scan of one enabled tracked prompt across the project's engines, for example to check a prompt again after publishing content for it. Only that prompt's checks run, so it costs less than a full scan. Otherwise it behaves like `POST /v1/projects/{projectId}/geo/scans`: poll `statusUrl` until `status` leaves `running`, 409 while another scan is in flight, 402 when the plan or AI credits cannot cover it, and it shares that route's rate limit. Returns 404 for a prompt that is unknown or disabled.",
  request: { params: promptParamsSchema },
  responses: {
    202: {
      description: "Scan accepted",
      headers: {
        Location: {
          description: "Relative path of the scan created for this trigger.",
          schema: { type: "string" as const },
        },
      },
      content: { "application/json": { schema: createScanResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    429: rateLimitResponse(
      RATE_LIMITS.scanTrigger.requests,
      RATE_LIMITS.scanTrigger.window
    ),
  },
});

const listScansRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/scans",
  tags: [GEO_OPENAPI_TAG],
  operationId: "listGeoScans",
  summary: "List GEO scans",
  description:
    "Lists scans with planned, completed, mentioned, and explicitly failed check totals by engine. Failed scans include safe failure metadata when available.",
  request: { params: projectParamsSchema, query: listScansQuerySchema },
  responses: {
    200: {
      description: "Scans fetched successfully",
      content: { "application/json": { schema: listScansResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const getScanRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/scans/{scanId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "getGeoScan",
  summary: "Get a single GEO scan",
  description:
    "Returns scan status, check progress and mentions by engine, plus safe failure metadata for failed scans. Legacy scans without a saved plan report null planned totals.",
  request: { params: scanParamsSchema },
  responses: {
    200: {
      description: "Scan fetched successfully",
      content: { "application/json": { schema: scanResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

function scanStartedResponse(
  c: Context<ApiEnv>,
  projectId: string,
  outcome: GeoOutcome<{ scanId: string }>
) {
  if (!outcome.ok) {
    return geoErrorResponse(c, outcome.failure);
  }

  const base = c.get("geo");
  const { scanId } = outcome.value;
  const statusUrl = `/v1/projects/${projectId}/geo/scans/${scanId}`;
  trackApiEvent(c, {
    event: POSTHOG_EVENTS.GEO_SCAN_STARTED,
    organizationId: base.organizationId,
    projectId,
    properties: { trigger: API_TRIGGER_SOURCE, scan_id: scanId },
  });

  return c.json(
    attachGeoOrganization(base.organization, { scanId, statusUrl }),
    202,
    {
      Location: statusUrl,
    }
  );
}

geoScansRoutes.openapi(createScanRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");

  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.scanTrigger,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const outcome = await runGeoEffect(
    "startScan",
    startGeoScan({ organizationId: base.organizationId, projectId })
  );
  return scanStartedResponse(c, projectId, outcome);
});

geoScansRoutes.openapi(createPromptScanRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, promptId } = c.req.valid("param");

  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.scanTrigger,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const outcome = await runGeoEffect(
    "startPromptScan",
    startGeoPromptRescan({
      organizationId: base.organizationId,
      projectId,
      promptId,
    })
  );
  return scanStartedResponse(c, projectId, outcome);
});

geoScansRoutes.openapi(listScansRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const { limit, page } = c.req.valid("query");

  const outcome = await runGeoEffect(
    "listScans",
    listGeoScansForProject({
      organizationId: base.organizationId,
      projectId,
      limit,
      page,
    })
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoScansRoutes.openapi(getScanRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, scanId } = c.req.valid("param");

  const outcome = await runGeoEffect(
    "getScan",
    getGeoScanForProject({
      organizationId: base.organizationId,
      projectId,
      scanId,
    })
  );
  return geoOutcomeResponse(c, outcome, 200);
});
