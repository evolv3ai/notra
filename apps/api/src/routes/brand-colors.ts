import { randomUUID } from "node:crypto";

import { createRoute } from "@hono/zod-openapi";
import { brandGuidelineColors } from "@notra/db/schema";
import {
  brandColorParamsSchema,
  brandColorResponseSchema,
  createBrandColorRequestSchema,
  deleteBrandColorResponseSchema,
  listBrandColorsResponseSchema,
  patchBrandColorRequestSchema,
} from "@notra/schemas/api/brand-colors";
import { getBrandIdentityParamsSchema } from "@notra/schemas/api/content";
import { asc, eq, sql } from "drizzle-orm";

import {
  brandColorColumns,
  brandColorInGuideline,
  findBrandGuidelineId,
} from "../utils/brand-colors";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse } from "../utils/openapi-responses";
import { resolveRequestOrganization } from "../utils/organizations";

export const brandColorsRoutes = createOpenApiApp();

const GUIDELINES_NOT_FOUND =
  "Brand identity not found or its brand guidelines have not been generated";

const commonErrors = {
  401: errorResponse("Missing or invalid API key"),
  403: errorResponse("Forbidden"),
  503: errorResponse("Authentication service unavailable"),
};

const listBrandColorsRoute = createRoute({
  method: "get",
  path: "/brand-identities/{brandIdentityId}/colors",
  tags: ["Content"],
  operationId: "listBrandColors",
  summary: "List brand colors",
  description: "Returns the brand guideline colors of a brand identity.",
  request: { params: getBrandIdentityParamsSchema },
  responses: {
    200: {
      description: "Brand colors fetched successfully",
      content: {
        "application/json": { schema: listBrandColorsResponseSchema },
      },
    },
    400: errorResponse("Invalid path params"),
    404: errorResponse(GUIDELINES_NOT_FOUND),
    ...commonErrors,
  },
});

const createBrandColorRoute = createRoute({
  method: "post",
  path: "/brand-identities/{brandIdentityId}/colors",
  tags: ["Content"],
  operationId: "createBrandColor",
  summary: "Add a brand color",
  description: "Adds a color to the brand guidelines of a brand identity.",
  request: {
    params: getBrandIdentityParamsSchema,
    body: {
      content: {
        "application/json": { schema: createBrandColorRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Brand color created successfully",
      content: { "application/json": { schema: brandColorResponseSchema } },
    },
    400: errorResponse("Invalid path params or request body"),
    404: errorResponse(GUIDELINES_NOT_FOUND),
    ...commonErrors,
  },
});

const patchBrandColorRoute = createRoute({
  method: "patch",
  path: "/brand-identities/{brandIdentityId}/colors/{colorId}",
  tags: ["Content"],
  operationId: "updateBrandColor",
  summary: "Update a brand color",
  description: "Updates the given fields of a brand color.",
  request: {
    params: brandColorParamsSchema,
    body: {
      content: {
        "application/json": { schema: patchBrandColorRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Brand color updated successfully",
      content: { "application/json": { schema: brandColorResponseSchema } },
    },
    400: errorResponse("Invalid path params or request body"),
    404: errorResponse("Brand color not found"),
    ...commonErrors,
  },
});

const deleteBrandColorRoute = createRoute({
  method: "delete",
  path: "/brand-identities/{brandIdentityId}/colors/{colorId}",
  tags: ["Content"],
  operationId: "deleteBrandColor",
  summary: "Delete a brand color",
  description: "Removes a color from the brand guidelines.",
  request: { params: brandColorParamsSchema },
  responses: {
    200: {
      description: "Brand color deleted successfully",
      content: {
        "application/json": { schema: deleteBrandColorResponseSchema },
      },
    },
    400: errorResponse("Invalid path params"),
    404: errorResponse("Brand color not found"),
    ...commonErrors,
  },
});

brandColorsRoutes.openapi(listBrandColorsRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const db = c.get("db");
  const { brandIdentityId } = c.req.valid("param");

  const guidelineId = await findBrandGuidelineId(
    db,
    scope.orgId,
    brandIdentityId
  );
  if (!guidelineId) {
    return c.json({ error: GUIDELINES_NOT_FOUND }, 404);
  }

  const colors = await db
    .select(brandColorColumns)
    .from(brandGuidelineColors)
    .where(eq(brandGuidelineColors.guidelineId, guidelineId))
    .orderBy(asc(brandGuidelineColors.sortOrder));

  return c.json({ colors, organization: scope.organization }, 200);
});

brandColorsRoutes.openapi(createBrandColorRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const db = c.get("db");
  const { brandIdentityId } = c.req.valid("param");
  const body = c.req.valid("json");

  const guidelineId = await findBrandGuidelineId(
    db,
    scope.orgId,
    brandIdentityId
  );
  if (!guidelineId) {
    return c.json({ error: GUIDELINES_NOT_FOUND }, 404);
  }

  const [color] = await db
    .insert(brandGuidelineColors)
    .values({
      id: randomUUID(),
      guidelineId,
      role: body.role,
      name: body.name ?? null,
      lightValue: body.lightValue,
      darkValue: body.darkValue ?? null,
      usage: body.usage ?? null,
      sortOrder: sql`(select coalesce(max(${brandGuidelineColors.sortOrder}), -1) + 1 from ${brandGuidelineColors} where ${brandGuidelineColors.guidelineId} = ${guidelineId})`,
    })
    .returning(brandColorColumns);

  if (!color) {
    throw new Error("Failed to create brand color");
  }

  return c.json({ color, organization: scope.organization }, 201);
});

brandColorsRoutes.openapi(patchBrandColorRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const db = c.get("db");
  const { brandIdentityId, colorId } = c.req.valid("param");
  const body = c.req.valid("json");

  const guidelineId = await findBrandGuidelineId(
    db,
    scope.orgId,
    brandIdentityId
  );
  if (!guidelineId) {
    return c.json({ error: "Brand color not found" }, 404);
  }

  const [color] = await db
    .update(brandGuidelineColors)
    .set(body)
    .where(brandColorInGuideline(guidelineId, colorId))
    .returning(brandColorColumns);

  if (!color) {
    return c.json({ error: "Brand color not found" }, 404);
  }

  return c.json({ color, organization: scope.organization }, 200);
});

brandColorsRoutes.openapi(deleteBrandColorRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const db = c.get("db");
  const { brandIdentityId, colorId } = c.req.valid("param");

  const guidelineId = await findBrandGuidelineId(
    db,
    scope.orgId,
    brandIdentityId
  );
  if (!guidelineId) {
    return c.json({ error: "Brand color not found" }, 404);
  }

  const [deleted] = await db
    .delete(brandGuidelineColors)
    .where(brandColorInGuideline(guidelineId, colorId))
    .returning({ id: brandGuidelineColors.id });

  if (!deleted) {
    return c.json({ error: "Brand color not found" }, 404);
  }

  return c.json({ id: deleted.id, organization: scope.organization }, 200);
});
