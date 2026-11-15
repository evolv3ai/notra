import { createRoute } from "@hono/zod-openapi";
import { GEO_DOMAIN_REGEX } from "@notra/geo-core/constants/geo";
import { parseCompetitorsCsv } from "@notra/geo-core/geo/csv-import";
import { normalizeCompetitorDomain } from "@notra/geo-core/geo/domain";
import { suggestGeoCompetitors } from "@notra/geo-core/geo/onboarding";
import {
  deleteGeoCompetitor,
  importGeoCompetitors,
  loadGeoCompetitors,
  upsertGeoCompetitor,
} from "@notra/geo-core/geo/programs";
import type { GeoCompetitor } from "@notra/geo-core/types/geo";
import type { GeoCompetitorImportRow } from "@notra/geo-core/types/geo-import";
import {
  competitorSuggestionsQuerySchema,
  competitorSuggestionsResponseSchema,
  importCompetitorsRequestSchema,
  importCompetitorsResponseSchema,
  listCompetitorsResponseSchema,
  putCompetitorRequestSchema,
} from "@notra/schemas/api/geo-competitors";
import {
  competitorParamsSchema,
  projectParamsSchema,
} from "@notra/schemas/api/geo-params";
import { Effect } from "effect";

import {
  GEO_COMMON_ERROR_RESPONSES,
  GEO_OPENAPI_TAG,
} from "../constants/geo-openapi";
import { runGeoEffect } from "../runtime/geo";
import { geoOutcomeResponse, refreshGeoGapsAfter } from "../utils/geo";
import { createOpenApiApp } from "../utils/openapi-app";
import { rateLimitResponse } from "../utils/openapi-responses";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "../utils/ratelimit";

export const geoCompetitorsRoutes = createOpenApiApp();

const listCompetitorsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/competitors",
  tags: [GEO_OPENAPI_TAG],
  operationId: "listGeoCompetitors",
  summary: "List tracked GEO competitors",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Competitors fetched successfully",
      content: {
        "application/json": { schema: listCompetitorsResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const putCompetitorRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/geo/competitors",
  tags: [GEO_OPENAPI_TAG],
  operationId: "upsertGeoCompetitor",
  summary: "Create or update a tracked GEO competitor",
  description:
    "Matches on name, case-insensitively. Send `previousName` to rename an existing competitor. Returns the full competitor list.",
  request: {
    params: projectParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: putCompetitorRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Competitor saved successfully",
      content: {
        "application/json": { schema: listCompetitorsResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const suggestCompetitorsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/competitors/suggestions",
  tags: [GEO_OPENAPI_TAG],
  operationId: "suggestGeoCompetitors",
  summary: "Suggest GEO competitors for a domain",
  description:
    "Discovers likely competitors for a website. Results are cached per organization and domain.",
  request: {
    params: projectParamsSchema,
    query: competitorSuggestionsQuerySchema,
  },
  responses: {
    200: {
      description: "Competitor suggestions fetched successfully",
      content: {
        "application/json": { schema: competitorSuggestionsResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    429: rateLimitResponse(
      RATE_LIMITS.competitorSuggestions.requests,
      RATE_LIMITS.competitorSuggestions.window
    ),
  },
});

const deleteCompetitorRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/geo/competitors/{name}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "deleteGeoCompetitor",
  summary: "Stop tracking a GEO competitor",
  request: { params: competitorParamsSchema },
  responses: {
    200: {
      description: "Competitor deleted successfully",
      content: {
        "application/json": { schema: listCompetitorsResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const importCompetitorsRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/geo/competitors/import",
  tags: [GEO_OPENAPI_TAG],
  operationId: "importGeoCompetitors",
  summary: "Bulk import GEO competitors",
  description:
    "Accepts either structured `rows` or raw `csv` text. Existing competitors are updated in place rather than duplicated. One request takes a project's whole list (up to 2,000 competitors), so send it in a single call instead of splitting it.",
  request: {
    params: projectParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: importCompetitorsRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Competitors imported successfully",
      content: {
        "application/json": { schema: importCompetitorsResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    429: rateLimitResponse(
      RATE_LIMITS.competitorImport.requests,
      RATE_LIMITS.competitorImport.window
    ),
  },
});

const pickCompetitors = Effect.map(
  ({ competitors }: { competitors: GeoCompetitor[] }) => ({ competitors })
);

geoCompetitorsRoutes.openapi(listCompetitorsRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "competitors",
    loadGeoCompetitors({ organizationId: base.organizationId, projectId }).pipe(
      pickCompetitors
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoCompetitorsRoutes.openapi(putCompetitorRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "competitorUpsert",
    upsertGeoCompetitor(scope, c.req.valid("json")).pipe(
      refreshGeoGapsAfter(scope),
      pickCompetitors
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoCompetitorsRoutes.openapi(suggestCompetitorsRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");

  const domain = normalizeCompetitorDomain(c.req.valid("query").domain);
  if (!domain || !GEO_DOMAIN_REGEX.test(domain)) {
    return c.json({ error: "Enter a domain like example.com" }, 400);
  }

  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.competitorSuggestions,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const outcome = await runGeoEffect(
    "competitorSuggestions",
    suggestGeoCompetitors(
      { organizationId: base.organizationId, projectId },
      domain
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoCompetitorsRoutes.openapi(deleteCompetitorRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, name } = c.req.valid("param");
  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "competitorDelete",
    deleteGeoCompetitor(scope, name).pipe(
      refreshGeoGapsAfter(scope),
      pickCompetitors
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoCompetitorsRoutes.openapi(importCompetitorsRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const body = c.req.valid("json");

  let rows: readonly GeoCompetitorImportRow[] = body.rows ?? [];
  let issues: { line: number; message: string }[] = [];
  if (!body.rows && body.csv) {
    const parsed = parseCompetitorsCsv(body.csv);
    rows = parsed.rows;
    issues = parsed.issues;
    if (rows.length === 0) {
      return c.json(
        {
          error:
            issues[0]?.message ??
            "No importable competitors found in the CSV text",
        },
        400
      );
    }
  }

  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.competitorImport,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const scope = { organizationId: base.organizationId, projectId };
  const outcome = await runGeoEffect(
    "competitorsImport",
    importGeoCompetitors(scope, rows).pipe(
      refreshGeoGapsAfter(scope),
      Effect.map(({ imported, updated, skipped, competitors }) => ({
        imported,
        updated,
        skipped,
        issues,
        competitors,
      }))
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});
