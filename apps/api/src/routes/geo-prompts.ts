import { createRoute } from "@hono/zod-openapi";
import { parsePromptsCsv } from "@notra/geo-core/geo/csv-import";
import {
  createGeoPrompt,
  deleteGeoPrompt,
  importGeoPrompts,
  listGeoPrompts,
  updateGeoPrompt,
} from "@notra/geo-core/geo/programs";
import {
  acceptSuggestion,
  dismissSuggestion,
  listSuggestions,
} from "@notra/geo-core/geo/suggestions";
import type { GeoPromptImportRow } from "@notra/geo-core/types/geo-import";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  projectParamsSchema,
  promptParamsSchema,
} from "@notra/schemas/api/geo-params";
import {
  createPromptRequestSchema,
  deletePromptResponseSchema,
  dismissPromptSuggestionResponseSchema,
  importPromptsRequestSchema,
  importPromptsResponseSchema,
  listPromptsResponseSchema,
  listPromptSuggestionsResponseSchema,
  patchPromptRequestSchema,
  promptResponseSchema,
  promptSuggestionParamsSchema,
} from "@notra/schemas/api/geo-prompts";
import { Effect } from "effect";

import { API_TRIGGER_SOURCE } from "../constants/analytics";
import {
  GEO_COMMON_ERROR_RESPONSES,
  GEO_OPENAPI_TAG,
} from "../constants/geo-openapi";
import { runGeoEffect } from "../runtime/geo";
import { trackApiEvent } from "../utils/analytics";
import { geoOutcomeResponse, refreshGeoGapsAfter } from "../utils/geo";
import { createOpenApiApp } from "../utils/openapi-app";
import { rateLimitResponse } from "../utils/openapi-responses";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "../utils/ratelimit";

export const geoPromptsRoutes = createOpenApiApp();

const listPromptsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/prompts",
  tags: [GEO_OPENAPI_TAG],
  operationId: "listGeoPrompts",
  summary: "List tracked GEO prompts",
  description:
    "Returns custom prompts alongside the prompts derived automatically from the project's brand context.",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Prompts fetched successfully",
      content: { "application/json": { schema: listPromptsResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const createPromptRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/prompts",
  tags: [GEO_OPENAPI_TAG],
  operationId: "createGeoPrompt",
  summary: "Track a new GEO prompt",
  request: {
    params: projectParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: createPromptRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Prompt created successfully",
      content: { "application/json": { schema: promptResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const patchPromptRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/geo/prompts/{promptId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "updateGeoPrompt",
  summary: "Update a tracked GEO prompt",
  description:
    "Enable or disable a tracked prompt, or replace tags on a custom prompt.",
  request: {
    params: promptParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: patchPromptRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Prompt updated successfully",
      content: { "application/json": { schema: promptResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const deletePromptRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/geo/prompts/{promptId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "deleteGeoPrompt",
  summary: "Stop tracking a GEO prompt",
  request: { params: promptParamsSchema },
  responses: {
    200: {
      description: "Prompt deleted successfully",
      content: { "application/json": { schema: deletePromptResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const importPromptsRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/prompts/import",
  tags: [GEO_OPENAPI_TAG],
  operationId: "importGeoPrompts",
  summary: "Bulk import GEO prompts",
  description:
    "Accepts either structured `rows` or raw `csv` text. Prompts that already exist are skipped, not duplicated.",
  request: {
    params: projectParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: importPromptsRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Prompts imported successfully",
      content: { "application/json": { schema: importPromptsResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    429: rateLimitResponse(
      RATE_LIMITS.promptImport.requests,
      RATE_LIMITS.promptImport.window
    ),
  },
});

const listSuggestionsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/prompts/suggestions",
  tags: [GEO_OPENAPI_TAG],
  operationId: "listGeoPromptSuggestions",
  summary: "List prompt suggestions",
  description:
    "Pending prompts Notra suggests tracking, derived from the project's Google Search Console queries. Empty until Search Console is connected and synced in the dashboard.",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Prompt suggestions fetched successfully",
      content: {
        "application/json": { schema: listPromptSuggestionsResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const acceptSuggestionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/prompts/suggestions/{suggestionId}/accept",
  tags: [GEO_OPENAPI_TAG],
  operationId: "acceptGeoPromptSuggestion",
  summary: "Accept a prompt suggestion",
  description:
    "Tracks the suggested prompt and returns it. When the project already tracks the same prompt, that prompt is returned instead of a duplicate. Returns 404 once the suggestion is no longer pending.",
  request: { params: promptSuggestionParamsSchema },
  responses: {
    200: {
      description: "Prompt suggestion accepted successfully",
      content: { "application/json": { schema: promptResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const dismissSuggestionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/prompts/suggestions/{suggestionId}/dismiss",
  tags: [GEO_OPENAPI_TAG],
  operationId: "dismissGeoPromptSuggestion",
  summary: "Dismiss a prompt suggestion",
  description:
    "Removes the suggestion from the pending list without tracking it. Returns 404 once the suggestion is no longer pending.",
  request: { params: promptSuggestionParamsSchema },
  responses: {
    200: {
      description: "Prompt suggestion dismissed successfully",
      content: {
        "application/json": { schema: dismissPromptSuggestionResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

geoPromptsRoutes.openapi(listPromptsRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "promptsList",
    listGeoPrompts({ organizationId: base.organizationId, projectId }).pipe(
      Effect.map(({ configured, prompts }) => ({ configured, prompts }))
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoPromptsRoutes.openapi(createPromptRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const { prompt, tags } = c.req.valid("json");
  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "promptsCreate",
    createGeoPrompt(scope, prompt, undefined, tags ?? []).pipe(
      refreshGeoGapsAfter(scope),
      Effect.map((created) => ({ prompt: created }))
    )
  );
  return geoOutcomeResponse(c, outcome, 201);
});

geoPromptsRoutes.openapi(patchPromptRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, promptId } = c.req.valid("param");
  const { enabled, tags } = c.req.valid("json");
  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "promptsUpdate",
    updateGeoPrompt(scope, promptId, { enabled, tags }).pipe(
      refreshGeoGapsAfter(scope),
      Effect.map((prompt) => ({ prompt }))
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoPromptsRoutes.openapi(deletePromptRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, promptId } = c.req.valid("param");
  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "promptsDelete",
    deleteGeoPrompt(scope, promptId).pipe(
      refreshGeoGapsAfter(scope),
      Effect.as({ id: promptId })
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoPromptsRoutes.openapi(importPromptsRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const body = c.req.valid("json");

  let rows: readonly GeoPromptImportRow[] = body.rows ?? [];
  let issues: { line: number; message: string }[] = [];
  if (!body.rows && body.csv) {
    const parsed = parsePromptsCsv(body.csv);
    rows = parsed.rows;
    issues = parsed.issues;
    if (rows.length === 0) {
      return c.json(
        {
          error:
            issues[0]?.message ?? "No importable prompts found in the CSV text",
        },
        400
      );
    }
  }

  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.promptImport,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "promptsImport",
    importGeoPrompts(scope, rows).pipe(
      refreshGeoGapsAfter(scope),
      Effect.map(({ imported, updated, skipped }) => ({
        imported,
        updated,
        skipped,
        issues,
      }))
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoPromptsRoutes.openapi(listSuggestionsRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "suggestionsList",
    listSuggestions({ organizationId: base.organizationId, projectId })
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoPromptsRoutes.openapi(acceptSuggestionRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, suggestionId } = c.req.valid("param");
  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "suggestionAccept",
    acceptSuggestion({ ...scope, suggestionId }).pipe(
      refreshGeoGapsAfter(scope)
    )
  );
  if (outcome.ok) {
    const { suggestion } = outcome.value;
    trackApiEvent(c, {
      event: POSTHOG_EVENTS.GEO_SUGGESTION_ACCEPTED,
      organizationId: base.organizationId,
      projectId,
      properties: {
        count: 1,
        suggestion_id: suggestion.id,
        source: suggestion.source,
        action: suggestion.action,
        trigger: API_TRIGGER_SOURCE,
      },
    });
  }
  return geoOutcomeResponse(c, outcome, 200, ({ prompt }) => ({ prompt }));
});

geoPromptsRoutes.openapi(dismissSuggestionRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, suggestionId } = c.req.valid("param");
  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "suggestionDismiss",
    dismissSuggestion({ ...scope, suggestionId }).pipe(
      refreshGeoGapsAfter(scope),
      Effect.map((result) => ({
        id: result.suggestionId,
        dismissed: result.dismissed,
      }))
    )
  );
  if (outcome.ok) {
    trackApiEvent(c, {
      event: POSTHOG_EVENTS.GEO_SUGGESTION_DISMISSED,
      organizationId: base.organizationId,
      projectId,
      properties: {
        count: 1,
        suggestion_id: suggestionId,
        trigger: API_TRIGGER_SOURCE,
      },
    });
  }
  return geoOutcomeResponse(c, outcome, 200);
});
