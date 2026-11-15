import { createRoute } from "@hono/zod-openapi";
import {
  createGitHubIntegrationRequestSchema,
  createGitHubIntegrationResponseSchema,
  deleteIntegrationResponseSchema,
  getGitHubActivityQuerySchema,
  getGitHubActivityResponseSchema,
  getIntegrationParamsSchema,
  getIntegrationsResponseSchema,
} from "@notra/schemas/api/content";

import {
  assertNoGitHubIntegrationDuplicate,
  createGitHubIntegration,
  deleteIntegration,
  getGitHubActivity,
  listIntegrations,
} from "../programs/integrations";
import {
  respondToIntegrationFailure,
  runIntegrationProgram,
} from "../utils/integrations";
import { logError } from "../utils/logging";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse, rateLimitResponse } from "../utils/openapi-responses";
import { resolveRequestOrganization } from "../utils/organizations";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "../utils/ratelimit";

export const integrationsRoutes = createOpenApiApp();

const getIntegrationsRoute = createRoute({
  method: "get",
  path: "/integrations",
  tags: ["Content"],
  operationId: "listIntegrations",
  summary: "List available integrations",
  description:
    "Returns the enabled GitHub and Linear integrations for the organization. The slack array is always empty.",
  responses: {
    200: {
      description: "Integrations fetched successfully",
      content: {
        "application/json": {
          schema: getIntegrationsResponseSchema,
        },
      },
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const createGitHubIntegrationRoute = createRoute({
  method: "post",
  path: "/integrations/github",
  tags: ["Content"],
  operationId: "createGitHubIntegration",
  summary: "Create a GitHub integration",
  description:
    "Checks that the repository can be read (a personal access token is required for private repositories), connects it, and enables changelog generation for it; blog post and X post outputs start disabled. A webhook secret is generated on creation. Copy the payload URL and secret from the dashboard to receive push and release events.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createGitHubIntegrationRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "GitHub integration created successfully",
      content: {
        "application/json": {
          schema: createGitHubIntegrationResponseSchema,
        },
      },
    },
    400: errorResponse(
      "Invalid request body or GitHub repository access error"
    ),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    409: errorResponse("Repository already connected"),
    429: rateLimitResponse(
      RATE_LIMITS.integrationCreate.requests,
      RATE_LIMITS.integrationCreate.window,
      "API key"
    ),
    503: errorResponse("Authentication or integration service unavailable"),
  },
});

const getGitHubActivityRoute = createRoute({
  method: "get",
  path: "/integrations/github/{integrationId}/activity",
  tags: ["Content"],
  operationId: "getGitHubActivity",
  summary: "List recent GitHub activity",
  description:
    "Lists pull requests merged into the default branch, commits on the default branch, or releases published in a connected repository within a time window, so you can decide what to write about before calling create_post or generate_post. Reads GitHub live; pagination follows GitHub's pages, so a page can hold fewer items than the page size while nextPage is still set.",
  request: {
    params: getIntegrationParamsSchema,
    query: getGitHubActivityQuerySchema,
  },
  responses: {
    200: {
      description: "Activity fetched successfully",
      content: {
        "application/json": {
          schema: getGitHubActivityResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid request or repository no longer readable"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("GitHub integration not found"),
    503: errorResponse("GitHub unavailable or rate limited"),
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  path: "/integrations/{integrationId}",
  tags: ["Content"],
  operationId: "deleteIntegration",
  summary: "Delete a single integration",
  description:
    "Deletes a GitHub or Linear integration. Schedules and event triggers that target the integration are disabled and listed in the response.",
  request: {
    params: getIntegrationParamsSchema,
  },
  responses: {
    200: {
      description: "Integration deleted successfully",
      content: {
        "application/json": {
          schema: deleteIntegrationResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid path params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Integration not found"),
    503: errorResponse("Authentication service unavailable"),
  },
});

integrationsRoutes.openapi(getIntegrationsRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const result = await runIntegrationProgram(
    listIntegrations({ db: c.get("db"), organizationId: orgId })
  );

  if (result._tag === "Failure") {
    throw result.failure;
  }

  return c.json(
    {
      ...result.success,
      slack: [],
      organization,
    },
    200
  );
});

integrationsRoutes.openapi(createGitHubIntegrationRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const body = c.req.valid("json");

  const owner = body.owner.trim();
  const repo = body.repo.trim();

  const duplicateCheck = await runIntegrationProgram(
    assertNoGitHubIntegrationDuplicate({
      db: c.get("db"),
      organizationId: orgId,
      owner,
      repo,
    })
  );

  if (duplicateCheck._tag === "Failure") {
    return respondToIntegrationFailure(c, duplicateCheck.failure);
  }

  const rateLimited = await enforceRatelimit(c, ratelimit.integrationCreate);
  if (rateLimited) {
    return rateLimited;
  }

  const result = await runIntegrationProgram(
    createGitHubIntegration({
      db: c.get("db"),
      organizationId: orgId,
      body,
      runtimeEnv: c.env ?? {},
    })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "IntegrationCreateError") {
      logError("Failed to create GitHub integration", result.failure.cause);
    }

    return respondToIntegrationFailure(c, result.failure);
  }

  return c.json({ github: result.success, organization }, 201);
});

integrationsRoutes.openapi(getGitHubActivityRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const result = await runIntegrationProgram(
    getGitHubActivity({
      db: c.get("db"),
      organizationId: orgId,
      integrationId: c.req.valid("param").integrationId,
      query: c.req.valid("query"),
    })
  );

  if (result._tag === "Failure") {
    const { failure } = result;
    if (failure._tag === "IntegrationNotFoundError") {
      return c.json({ error: "GitHub integration not found" }, 404);
    }
    if (failure._tag === "GitHubAccessError") {
      return c.json({ error: failure.message }, 400);
    }
    logError("Failed to read GitHub activity", failure.cause);
    return c.json({ error: "GitHub is unavailable or rate limited" }, 503);
  }

  return c.json({ ...result.success, organization }, 200);
});

integrationsRoutes.openapi(deleteIntegrationRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const { integrationId } = c.req.valid("param");

  const result = await runIntegrationProgram(
    deleteIntegration({
      db: c.get("db"),
      organizationId: orgId,
      integrationId,
      runtimeEnv: (c.env ?? {}) as Record<string, unknown>,
    })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "IntegrationNotFoundError") {
      return c.json({ error: "Integration not found" }, 404);
    }
    throw result.failure;
  }

  return c.json(
    {
      ...result.success,
      organization,
    },
    200
  );
});
