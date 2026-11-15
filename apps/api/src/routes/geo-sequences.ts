import { createRoute } from "@hono/zod-openapi";
import {
  createGeoSequence,
  deleteGeoSequence,
  listGeoSequences,
  updateGeoSequence,
} from "@notra/geo-core/geo/sequences";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  projectParamsSchema,
  sequenceParamsSchema,
} from "@notra/schemas/api/geo-params";
import {
  createSequenceRequestSchema,
  deleteSequenceResponseSchema,
  listSequencesResponseSchema,
  patchSequenceRequestSchema,
  runSequenceResponseSchema,
  sequenceResponseSchema,
} from "@notra/schemas/api/geo-sequences";
import { Effect } from "effect";

import { API_TRIGGER_SOURCE } from "../constants/analytics";
import {
  GEO_COMMON_ERROR_RESPONSES,
  GEO_OPENAPI_TAG,
} from "../constants/geo-openapi";
import { runGeoEffect, runRemoteGeoEffect } from "../runtime/geo";
import { GEO_REMOTE_SEQUENCE_RUN } from "../runtime/geo-remote";
import { trackApiEvent } from "../utils/analytics";
import {
  attachGeoOrganization,
  geoOutcomeResponse,
  geoRemoteErrorResponse,
} from "../utils/geo";
import { getInternalWorkflowUrl } from "../utils/internal-workflow";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse, rateLimitResponse } from "../utils/openapi-responses";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "../utils/ratelimit";

export const geoSequencesRoutes = createOpenApiApp();

const listSequencesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/sequences",
  tags: [GEO_OPENAPI_TAG],
  operationId: "listGeoSequences",
  summary: "List GEO prompt sequences",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Sequences fetched successfully",
      content: { "application/json": { schema: listSequencesResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const createSequenceRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/sequences",
  tags: [GEO_OPENAPI_TAG],
  operationId: "createGeoSequence",
  summary: "Create a GEO prompt sequence",
  request: {
    params: projectParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: createSequenceRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Sequence created successfully",
      content: { "application/json": { schema: sequenceResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const patchSequenceRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/geo/sequences/{sequenceId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "updateGeoSequence",
  summary: "Update a GEO prompt sequence",
  request: {
    params: sequenceParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: patchSequenceRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Sequence updated successfully",
      content: { "application/json": { schema: sequenceResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const deleteSequenceRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/geo/sequences/{sequenceId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "deleteGeoSequence",
  summary: "Delete a GEO prompt sequence",
  request: { params: sequenceParamsSchema },
  responses: {
    200: {
      description: "Sequence deleted successfully",
      content: { "application/json": { schema: deleteSequenceResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const runSequenceRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/sequences/{sequenceId}/run",
  tags: [GEO_OPENAPI_TAG],
  operationId: "runGeoSequence",
  summary: "Run a GEO prompt sequence now",
  description:
    "Runs the sequence now. API-based answer engines run synchronously: the request stays open while every turn plays against each of them, which can take several minutes, and `checks`, `mentions` and `engines` report their result. Tracked consumer apps (ChatGPT, Perplexity, Gemini, AI Mode, Copilot) answer far more slowly, so they are queued as a background scan instead: `queuedScanId` names it and `queuedEngines` lists the apps it covers. Poll `GET /v1/projects/{projectId}/geo/scans/{scanId}` for that part. A run with only consumer apps answers right away with `checks: 0`. Runs also work while automatic scans are paused. Use a client timeout of at least five minutes; after four minutes the API stops waiting and answers 409 while the run finishes on its own. Do not retry; read the result from the project's GEO checks. The work happens inside the Notra dashboard, which owns the model credentials and billing gates; the public API never calls an answer engine itself. Results also land in the project's GEO checks.",
  request: { params: sequenceParamsSchema },
  responses: {
    200: {
      description:
        "API-based engines finished; a queued consumer-app scan is named by queuedScanId",
      content: { "application/json": { schema: runSequenceResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    409: errorResponse(
      "Sequence execution is still running after the internal timeout; do not retry the run"
    ),
    429: rateLimitResponse(
      RATE_LIMITS.sequenceRun.requests,
      RATE_LIMITS.sequenceRun.window
    ),
  },
});

geoSequencesRoutes.openapi(listSequencesRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "sequencesList",
    listGeoSequences({ organizationId: base.organizationId, projectId }).pipe(
      Effect.map(({ sequences }) => ({ sequences }))
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoSequencesRoutes.openapi(createSequenceRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const { name, steps } = c.req.valid("json");
  const outcome = await runGeoEffect(
    "sequenceCreate",
    createGeoSequence(
      { organizationId: base.organizationId, projectId },
      { name, steps }
    ).pipe(Effect.map((sequence) => ({ sequence })))
  );
  return geoOutcomeResponse(c, outcome, 201);
});

geoSequencesRoutes.openapi(patchSequenceRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, sequenceId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "sequenceUpdate",
    updateGeoSequence(
      { organizationId: base.organizationId, projectId },
      { sequenceId, ...c.req.valid("json") }
    ).pipe(Effect.map((sequence) => ({ sequence })))
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoSequencesRoutes.openapi(deleteSequenceRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, sequenceId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "sequenceDelete",
    deleteGeoSequence(
      { organizationId: base.organizationId, projectId },
      sequenceId
    ).pipe(Effect.as({ id: sequenceId }))
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoSequencesRoutes.openapi(runSequenceRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, sequenceId } = c.req.valid("param");

  const url = getInternalWorkflowUrl(c.env, GEO_REMOTE_SEQUENCE_RUN.path);
  if (!url) {
    return c.json({ error: GEO_REMOTE_SEQUENCE_RUN.unavailableMessage }, 503);
  }

  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.sequenceRun,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const outcome = await runRemoteGeoEffect(GEO_REMOTE_SEQUENCE_RUN, url, {
    organizationId: base.organizationId,
    projectId,
    sequenceId,
  });
  if (!outcome.ok) {
    return geoRemoteErrorResponse(c, outcome.failure);
  }

  const { checks, mentions, engines } = outcome.value;
  trackApiEvent(c, {
    event: POSTHOG_EVENTS.GEO_SEQUENCE_RUN,
    organizationId: base.organizationId,
    projectId,
    properties: {
      trigger: API_TRIGGER_SOURCE,
      sequence_id: sequenceId,
      check_count: checks,
    },
  });

  return c.json(
    attachGeoOrganization(base.organization, {
      checks,
      mentions,
      engines,
      queuedScanId: outcome.value.queuedScanId,
      queuedEngines: outcome.value.queuedEngines,
    }),
    200
  );
});
