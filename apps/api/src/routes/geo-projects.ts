import { createRoute } from "@hono/zod-openapi";
import {
  createGeoProject,
  deleteGeoProject,
  getGeoProject,
  listGeoProjects,
  updateGeoProject,
} from "@notra/geo-core/geo/projects";
import { projectParamsSchema } from "@notra/schemas/api/geo-params";
import {
  createProjectRequestSchema,
  deleteProjectResponseSchema,
  listProjectsResponseSchema,
  patchProjectRequestSchema,
  projectResponseSchema,
} from "@notra/schemas/api/geo-projects";
import { Effect } from "effect";

import {
  GEO_COMMON_ERROR_RESPONSES,
  GEO_OPENAPI_TAG,
} from "../constants/geo-openapi";
import { runGeoEffect } from "../runtime/geo";
import { geoErrorResponse, geoOutcomeResponse } from "../utils/geo";
import { createOpenApiApp } from "../utils/openapi-app";

export const geoProjectsRoutes = createOpenApiApp();

const listProjectsRoute = createRoute({
  method: "get",
  path: "/projects",
  tags: [GEO_OPENAPI_TAG],
  operationId: "listProjects",
  summary: "List GEO projects",
  responses: {
    200: {
      description: "Projects fetched successfully",
      content: { "application/json": { schema: listProjectsResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const createProjectRoute = createRoute({
  method: "post",
  path: "/projects",
  tags: [GEO_OPENAPI_TAG],
  operationId: "createProject",
  summary: "Create a GEO project",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createProjectRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Project created successfully",
      content: { "application/json": { schema: projectResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const getProjectRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "getProject",
  summary: "Get a single GEO project",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Project fetched successfully",
      content: { "application/json": { schema: projectResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const patchProjectRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "updateProject",
  summary: "Rename a GEO project or relink its brand identity",
  request: {
    params: projectParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: patchProjectRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Project updated successfully",
      content: { "application/json": { schema: projectResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const deleteProjectRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}",
  tags: [GEO_OPENAPI_TAG],
  operationId: "deleteProject",
  summary: "Delete a GEO project and all of its GEO data",
  description:
    "Cascades to the project's GEO settings, prompts, sequences, competitors, scans, checks and reports, and cancels any pending scheduled scan. Agent feedback is kept but detached. The organization's last project cannot be deleted. Projects with hosted Sites cannot be deleted; delete their Sites first.",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Project deleted successfully",
      content: { "application/json": { schema: deleteProjectResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

geoProjectsRoutes.openapi(listProjectsRoute, async (c) => {
  const base = c.get("geo");
  const outcome = await runGeoEffect(
    "projectsList",
    listGeoProjects(base.organizationId).pipe(
      Effect.map(({ projects }) => ({ projects }))
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoProjectsRoutes.openapi(createProjectRoute, async (c) => {
  const base = c.get("geo");
  const { name, brandSettingsId } = c.req.valid("json");
  const outcome = await runGeoEffect(
    "projectCreate",
    createGeoProject(base.organizationId, name, brandSettingsId).pipe(
      Effect.map((project) => ({ project }))
    )
  );
  return geoOutcomeResponse(c, outcome, 201);
});

geoProjectsRoutes.openapi(getProjectRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "projectGet",
    getGeoProject(base.organizationId, projectId)
  );
  if (!outcome.ok) {
    return geoErrorResponse(c, outcome.failure);
  }

  const project = outcome.value;
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({ project, organization: base.organization }, 200);
});

geoProjectsRoutes.openapi(patchProjectRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "projectUpdate",
    updateGeoProject(base.organizationId, projectId, c.req.valid("json")).pipe(
      Effect.map((project) => ({ project }))
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoProjectsRoutes.openapi(deleteProjectRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "projectDelete",
    deleteGeoProject(base.organizationId, projectId).pipe(
      Effect.map(({ id }) => ({ id }))
    )
  );
  return geoOutcomeResponse(c, outcome, 200);
});
