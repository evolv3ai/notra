import { createRoute } from "@hono/zod-openapi";
import { trackAiTrafficEvent } from "@notra/ai/billing/ai-traffic-events";
import {
  feedbackOrganizationParamsSchema,
  feedbackParamsSchema,
  feedbackResponseSchema,
  listFeedbackQuerySchema,
  listFeedbackResponseSchema,
  submitFeedbackRequestSchema,
  submitFeedbackResponseSchema,
  updateFeedbackRequestSchema,
} from "@notra/schemas/api/feedback";
import type { Context } from "hono";
import type { z } from "zod";

import { API_FEEDBACK_VIA } from "../constants/analytics";
import {
  FEEDBACK_IDEMPOTENCY_CONFLICT_ERROR,
  FEEDBACK_NOT_FOUND_ERROR,
  FEEDBACK_ORGANIZATION_NOT_FOUND_ERROR,
  FEEDBACK_QUOTA_EXCEEDED_ERROR,
  FEEDBACK_PROJECT_NOT_FOUND_ERROR,
} from "../constants/feedback";
import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import {
  getFeedback as getFeedbackProgram,
  listFeedback as listFeedbackProgram,
  resolveOrganizationIdBySlug,
  submitFeedback as submitFeedbackProgram,
  updateFeedback as updateFeedbackProgram,
} from "../programs/feedback";
import type { SubmitFeedbackProgramSuccess } from "../types/feedback";
import { trackFeedbackReceived } from "../utils/analytics";
import { getOrganizationId } from "../utils/auth";
import {
  getIngestProjectId,
  respondToFeedbackFailure,
  runFeedbackProgram,
  serializeFeedback,
} from "../utils/feedback";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse, rateLimitResponse } from "../utils/openapi-responses";
import {
  enforceRatelimit,
  enforceRatelimitForKey,
  RATE_LIMITS,
  ratelimit,
} from "../utils/ratelimit";

export const feedbackRoutes = createOpenApiApp();

const feedbackAcceptedResponse = {
  description: "Feedback accepted",
  content: {
    "application/json": { schema: submitFeedbackResponseSchema },
  },
};

const feedbackRateLimitedResponse = rateLimitResponse(
  RATE_LIMITS.feedbackIngest.requests,
  RATE_LIMITS.feedbackIngest.window,
  "API key"
);

const publicFeedbackRateLimitedResponse = rateLimitResponse(
  RATE_LIMITS.feedbackIngestIp.requests,
  RATE_LIMITS.feedbackIngestIp.window,
  `IP address, plus ${RATE_LIMITS.feedbackIngestOrganization.requests} requests per ${RATE_LIMITS.feedbackIngestOrganization.window} per organization`
);

const submitFeedbackBody = {
  required: true,
  content: {
    "application/json": { schema: submitFeedbackRequestSchema },
  },
};

const submitOrganizationFeedbackRoute = createRoute({
  method: "post",
  path: "/feedback/{organizationSlug}",
  tags: ["Feedback"],
  operationId: "submitOrganizationFeedback",
  summary: "Submit feedback to an organization's feedback URL",
  description:
    "Record feedback from an AI agent or integration by posting to the organization's feedback URL, as shown on the Feedback page in the dashboard. No credentials are required. Limited per source IP and per organization.",
  security: [],
  request: {
    params: feedbackOrganizationParamsSchema,
    body: submitFeedbackBody,
  },
  responses: {
    202: feedbackAcceptedResponse,
    400: errorResponse("Invalid request body"),
    402: errorResponse(FEEDBACK_QUOTA_EXCEEDED_ERROR),
    404: errorResponse(FEEDBACK_ORGANIZATION_NOT_FOUND_ERROR),
    409: errorResponse(FEEDBACK_IDEMPOTENCY_CONFLICT_ERROR),
    429: publicFeedbackRateLimitedResponse,
  },
});

const submitFeedbackRoute = createRoute({
  method: "post",
  path: "/feedback",
  tags: ["Feedback"],
  operationId: "submitFeedback",
  summary: "Submit feedback with an API key",
  description:
    "Record feedback for the organization that owns the credential. Requires an API key with the feedback.write scope. Agents and MCP servers should post to the organization's feedback URL instead.",
  request: {
    body: submitFeedbackBody,
  },
  responses: {
    202: feedbackAcceptedResponse,
    400: errorResponse("Invalid request body"),
    401: errorResponse("Missing or invalid credentials"),
    402: errorResponse(FEEDBACK_QUOTA_EXCEEDED_ERROR),
    403: errorResponse("Forbidden"),
    404: errorResponse(FEEDBACK_PROJECT_NOT_FOUND_ERROR),
    409: errorResponse(FEEDBACK_IDEMPOTENCY_CONFLICT_ERROR),
    429: feedbackRateLimitedResponse,
    503: errorResponse("Authentication service unavailable"),
  },
});

const listFeedbackRoute = createRoute({
  method: "get",
  path: "/feedback",
  tags: ["Feedback"],
  operationId: "listFeedback",
  summary: "List feedback",
  request: { query: listFeedbackQuerySchema },
  responses: {
    200: {
      description: "Feedback fetched successfully",
      content: { "application/json": { schema: listFeedbackResponseSchema } },
    },
    400: errorResponse("Invalid query params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const getFeedbackRoute = createRoute({
  method: "get",
  path: "/feedback/{feedbackId}",
  tags: ["Feedback"],
  operationId: "getFeedback",
  summary: "Get a single feedback entry",
  request: { params: feedbackParamsSchema },
  responses: {
    200: {
      description: "Feedback fetched successfully",
      content: { "application/json": { schema: feedbackResponseSchema } },
    },
    400: errorResponse("Invalid path params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse(FEEDBACK_NOT_FOUND_ERROR),
    503: errorResponse("Authentication service unavailable"),
  },
});

const updateFeedbackRoute = createRoute({
  method: "patch",
  path: "/feedback/{feedbackId}",
  tags: ["Feedback"],
  operationId: "updateFeedback",
  summary: "Update feedback status",
  request: {
    params: feedbackParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: updateFeedbackRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Feedback updated successfully",
      content: { "application/json": { schema: feedbackResponseSchema } },
    },
    400: errorResponse("Invalid path params or request body"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse(FEEDBACK_NOT_FOUND_ERROR),
    503: errorResponse("Authentication service unavailable"),
  },
});

async function submitFeedbackHandler(
  c: Context,
  organizationId: string,
  via: (typeof API_FEEDBACK_VIA)[keyof typeof API_FEEDBACK_VIA],
  body: z.infer<typeof submitFeedbackRequestSchema>
) {
  const result = await runFeedbackProgram(
    submitFeedbackProgram({
      db: c.get("db"),
      organizationId,
      body,
      ingestProjectId: getIngestProjectId(c),
      userAgent: c.req.header("user-agent") ?? null,
    })
  );
  if (result._tag === "Failure") {
    if (result.failure._tag === "FeedbackQuotaExceededError") {
      return c.json({ error: FEEDBACK_QUOTA_EXCEEDED_ERROR }, 402);
    }
    if (result.failure._tag === "FeedbackIdempotencyConflictError") {
      return c.json({ error: FEEDBACK_IDEMPOTENCY_CONFLICT_ERROR }, 409);
    }
    return respondToFeedbackFailure(c, result.failure);
  }

  const { deduplicated } = result.success;
  if (!deduplicated) {
    void trackAiTrafficEvent(organizationId);
  }
  const feedback = serializeFeedback(result.success.feedback);
  trackFeedbackReceived(c, { organizationId, feedback, deduplicated, via });

  return c.json({ feedback, deduplicated }, 202);
}

feedbackRoutes.openapi(submitOrganizationFeedbackRoute, async (c) => {
  const ipLimited = await enforceRatelimit(c, ratelimit.feedbackIngestIp, "ip");
  if (ipLimited) {
    return ipLimited;
  }

  const { organizationSlug } = c.req.valid("param");
  const organizationResult = await runFeedbackProgram(
    resolveOrganizationIdBySlug({
      db: c.get("db"),
      slug: organizationSlug,
    })
  );
  if (organizationResult._tag === "Failure") {
    return respondToFeedbackFailure(c, organizationResult.failure);
  }

  const organizationId = organizationResult.success;

  const organizationLimited = await enforceRatelimitForKey(
    c,
    ratelimit.feedbackIngestOrganization,
    organizationId
  );
  if (organizationLimited) {
    return organizationLimited;
  }

  return submitFeedbackHandler(
    c,
    organizationId,
    API_FEEDBACK_VIA.PUBLIC_SLUG,
    c.req.valid("json")
  );
});

feedbackRoutes.openapi(submitFeedbackRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }

  const rateLimited = await enforceRatelimit(c, ratelimit.feedbackIngest);
  if (rateLimited) {
    return rateLimited;
  }

  return submitFeedbackHandler(
    c,
    organizationId,
    API_FEEDBACK_VIA.TOKEN,
    c.req.valid("json")
  );
});

feedbackRoutes.openapi(listFeedbackRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }

  const result = await runFeedbackProgram(
    listFeedbackProgram({
      db: c.get("db"),
      organizationId,
      query: c.req.valid("query"),
    })
  );
  if (result._tag === "Failure") {
    throw result.failure;
  }

  const { feedback, pagination } = result.success;

  return c.json(
    {
      feedback: feedback.map(serializeFeedback),
      pagination,
    },
    200
  );
});

feedbackRoutes.openapi(getFeedbackRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }

  const { feedbackId } = c.req.valid("param");
  const result = await runFeedbackProgram(
    getFeedbackProgram({
      db: c.get("db"),
      organizationId,
      feedbackId,
    })
  );
  if (result._tag === "Failure") {
    return respondToFeedbackFailure(c, result.failure);
  }

  return c.json({ feedback: serializeFeedback(result.success) }, 200);
});

feedbackRoutes.openapi(updateFeedbackRoute, async (c) => {
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }

  const { feedbackId } = c.req.valid("param");
  const result = await runFeedbackProgram(
    updateFeedbackProgram({
      db: c.get("db"),
      organizationId,
      feedbackId,
      body: c.req.valid("json"),
    })
  );
  if (result._tag === "Failure") {
    return respondToFeedbackFailure(c, result.failure);
  }

  return c.json({ feedback: serializeFeedback(result.success) }, 200);
});
