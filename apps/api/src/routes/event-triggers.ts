import { createRoute } from "@hono/zod-openapi";
import {
  createEventTriggerRequestSchema,
  deleteEventTriggerResponseSchema,
  eventTriggerParamsSchema,
  eventTriggerResponseSchema,
  getEventTriggersQuerySchema,
  getEventTriggersResponseSchema,
  patchEventTriggerRequestSchema,
} from "@notra/schemas/api/event-triggers";

import {
  createEventTrigger,
  deleteEventTrigger,
  getEventTrigger,
  listEventTriggers,
  updateEventTrigger,
} from "../programs/event-triggers";
import {
  runEventTriggerProgram,
  safeSerializeEventTrigger,
  serializeEventTrigger,
} from "../utils/event-triggers";
import { logError } from "../utils/logging";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse } from "../utils/openapi-responses";
import { resolveRequestOrganization } from "../utils/organizations";
import {
  ORGANIZATION_EVENT_TRIGGER_PATH_REGEX,
  ORGANIZATION_EVENT_TRIGGERS_PATH_REGEX,
} from "../utils/regex";
import { redirectLegacyOrganizationPath } from "./legacy-redirects";

export const eventTriggersRoutes = createOpenApiApp();

eventTriggersRoutes.on(
  ["GET", "POST"],
  "/:organizationId/event-triggers",
  redirectLegacyOrganizationPath(
    ORGANIZATION_EVENT_TRIGGERS_PATH_REGEX,
    () => "/event-triggers"
  )
);

eventTriggersRoutes.on(
  ["GET", "PATCH", "DELETE"],
  "/:organizationId/event-triggers/:triggerId",
  redirectLegacyOrganizationPath(
    ORGANIZATION_EVENT_TRIGGER_PATH_REGEX,
    (param) => `/event-triggers/${param("triggerId")}`
  )
);

const getEventTriggersRoute = createRoute({
  method: "get",
  path: "/event-triggers",
  tags: ["Event Triggers"],
  operationId: "listEventTriggers",
  summary: "List event triggers",
  request: {
    query: getEventTriggersQuerySchema,
  },
  responses: {
    200: {
      description: "Event triggers fetched successfully",
      content: {
        "application/json": {
          schema: getEventTriggersResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid query params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    500: errorResponse("Failed to list event triggers"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const createEventTriggerRoute = createRoute({
  method: "post",
  path: "/event-triggers",
  tags: ["Event Triggers"],
  operationId: "createEventTrigger",
  summary: "Create an event trigger",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: createEventTriggerRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Event trigger created successfully",
      content: {
        "application/json": {
          schema: eventTriggerResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid request"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    409: errorResponse("Duplicate event trigger"),
    500: errorResponse("Failed to create event trigger"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const getEventTriggerRoute = createRoute({
  method: "get",
  path: "/event-triggers/{triggerId}",
  tags: ["Event Triggers"],
  operationId: "getEventTrigger",
  summary: "Get an event trigger",
  request: {
    params: eventTriggerParamsSchema,
  },
  responses: {
    200: {
      description: "Event trigger fetched successfully",
      content: {
        "application/json": {
          schema: eventTriggerResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid path params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Event trigger or organization not found"),
    500: errorResponse("Failed to fetch event trigger"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const patchEventTriggerRoute = createRoute({
  method: "patch",
  path: "/event-triggers/{triggerId}",
  tags: ["Event Triggers"],
  operationId: "updateEventTrigger",
  summary: "Update an event trigger",
  request: {
    params: eventTriggerParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: patchEventTriggerRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Event trigger updated successfully",
      content: {
        "application/json": {
          schema: eventTriggerResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid request"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Event trigger or organization not found"),
    409: errorResponse("Duplicate event trigger"),
    500: errorResponse("Failed to update event trigger"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const deleteEventTriggerRoute = createRoute({
  method: "delete",
  path: "/event-triggers/{triggerId}",
  tags: ["Event Triggers"],
  operationId: "deleteEventTrigger",
  summary: "Delete an event trigger",
  request: {
    params: eventTriggerParamsSchema,
  },
  responses: {
    200: {
      description: "Event trigger deleted successfully",
      content: {
        "application/json": {
          schema: deleteEventTriggerResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid path params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Event trigger or organization not found"),
    500: errorResponse("Failed to delete event trigger"),
    503: errorResponse("Authentication service unavailable"),
  },
});

eventTriggersRoutes.openapi(getEventTriggersRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const { repositoryIds } = c.req.valid("query");
  const result = await runEventTriggerProgram(
    listEventTriggers({
      db: c.get("db"),
      organizationId: orgId,
      repositoryIds,
    })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "EventTriggerDatabaseError") {
      logError("Failed to list event triggers", result.failure.cause);
      return c.json({ error: "Failed to list event triggers" }, 500);
    }
    throw result.failure;
  }

  return c.json({ ...result.success, organization }, 200);
});

eventTriggersRoutes.openapi(createEventTriggerRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const body = c.req.valid("json");
  const result = await runEventTriggerProgram(
    createEventTrigger({ db: c.get("db"), organizationId: orgId, body })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "EventTriggerDuplicateError") {
      return c.json({ error: "Duplicate event trigger" }, 409);
    }
    if (result.failure._tag === "EventTriggerTargetsNotFoundError") {
      return c.json({ error: result.failure.message }, 400);
    }
    if (result.failure._tag === "EventTriggerDatabaseError") {
      logError("Failed to create event trigger", result.failure.cause);
      return c.json({ error: "Failed to create event trigger" }, 500);
    }
    throw result.failure;
  }

  return c.json(
    {
      eventTrigger: serializeEventTrigger(result.success),
      organization,
    },
    201
  );
});

eventTriggersRoutes.openapi(getEventTriggerRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const { triggerId } = c.req.valid("param");
  const result = await runEventTriggerProgram(
    getEventTrigger({ db: c.get("db"), organizationId: orgId, triggerId })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "EventTriggerNotFoundError") {
      return c.json({ error: "Event trigger not found" }, 404);
    }
    if (result.failure._tag === "EventTriggerDatabaseError") {
      logError("Failed to fetch event trigger", result.failure.cause);
      return c.json({ error: "Failed to fetch event trigger" }, 500);
    }
    throw result.failure;
  }

  const eventTrigger = safeSerializeEventTrigger(result.success);
  if (!eventTrigger) {
    return c.json({ error: "Failed to fetch event trigger" }, 500);
  }

  return c.json({ eventTrigger, organization }, 200);
});

eventTriggersRoutes.openapi(patchEventTriggerRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const { triggerId } = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await runEventTriggerProgram(
    updateEventTrigger({
      db: c.get("db"),
      organizationId: orgId,
      triggerId,
      body,
    })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "EventTriggerNotFoundError") {
      return c.json({ error: "Event trigger not found" }, 404);
    }
    if (result.failure._tag === "EventTriggerDuplicateError") {
      return c.json({ error: "Duplicate event trigger" }, 409);
    }
    if (result.failure._tag === "EventTriggerTargetsNotFoundError") {
      return c.json({ error: result.failure.message }, 400);
    }
    if (result.failure._tag === "EventTriggerDatabaseError") {
      logError("Failed to update event trigger", result.failure.cause);
      return c.json({ error: "Failed to update event trigger" }, 500);
    }
    throw result.failure;
  }

  return c.json(
    {
      eventTrigger: serializeEventTrigger(result.success),
      organization,
    },
    200
  );
});

eventTriggersRoutes.openapi(deleteEventTriggerRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const { triggerId } = c.req.valid("param");
  const result = await runEventTriggerProgram(
    deleteEventTrigger({ db: c.get("db"), organizationId: orgId, triggerId })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "EventTriggerNotFoundError") {
      return c.json({ error: "Event trigger not found" }, 404);
    }
    if (result.failure._tag === "EventTriggerDatabaseError") {
      logError("Failed to delete event trigger", result.failure.cause);
      return c.json({ error: "Failed to delete event trigger" }, 500);
    }
    throw result.failure;
  }

  return c.json({ id: result.success, organization }, 200);
});
