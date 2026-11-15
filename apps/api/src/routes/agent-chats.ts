import { createRoute } from "@hono/zod-openapi";
import {
  AgentSendLockedError,
  createAgentSessionWithMapping,
  forwardAgentFollowUp,
  forwardAgentStream,
  getAgentSessionMapping,
  listAgentSessionMappings,
} from "@notra/ai/utils/agent-proxy";
import {
  agentSessionParamsSchema,
  createAgentSessionRequestSchema,
  createAgentSessionResponseSchema,
  listAgentChatsQuerySchema,
  listAgentChatsResponseSchema,
  sendAgentMessageRequestSchema,
} from "@notra/schemas/api/agent-chats";
import { isDemoMode } from "@notra/utils/demo-mode";
import type { Context } from "hono";

import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import { createAgentClient, isAgentApiEnabled } from "../lib/agent/client";
import { isAccountKeyAuth, isOAuthAuth } from "../types/auth";
import { checkAgentAiCredits } from "../utils/agent-credits";
import { getOrganizationId } from "../utils/auth";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse, rateLimitResponse } from "../utils/openapi-responses";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "../utils/ratelimit";

export const agentChatsRoutes = createOpenApiApp();

const chatRateLimitResponse = rateLimitResponse(
  RATE_LIMITS.chatGeneration.requests,
  RATE_LIMITS.chatGeneration.window
);

const DEMO_AGENT_UNAVAILABLE =
  "The agent session API isn't available in the demo. Use POST /v1/chats to try the agent.";

const commonErrorResponses = {
  401: errorResponse("Missing or invalid API key"),
  403: errorResponse("Forbidden, or usage limit reached"),
  503: errorResponse("Agent service is not configured"),
};

async function requireAgentContext(c: Context) {
  if (isDemoMode()) {
    return {
      ok: false as const,
      response: c.json({ error: DEMO_AGENT_UNAVAILABLE }, 403),
    };
  }
  if (!isAgentApiEnabled()) {
    return {
      ok: false as const,
      response: c.json({ error: "Agent service is not configured" }, 503),
    };
  }
  const organizationId = getOrganizationId(c);
  if (!organizationId) {
    return {
      ok: false as const,
      response: c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403),
    };
  }
  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.chatGeneration,
    "organization"
  );
  if (rateLimited) {
    return { ok: false as const, response: rateLimited };
  }
  const auth = c.get("auth");
  const userId =
    auth && (isAccountKeyAuth(auth) || isOAuthAuth(auth)) ? auth.userId : null;
  return { ok: true as const, organizationId, userId };
}

/** Dashboard sessions belong to their user; org keys only see unowned ones. */
function canAccessSession(
  mapping: { userId: string | null },
  userId: string | null
) {
  return !mapping.userId || mapping.userId === userId;
}

agentChatsRoutes.openAPIRegistry.registerPath(
  createRoute({
    method: "post",
    path: "/eve/v1/session",
    tags: ["Agent"],
    operationId: "createAgentSession",
    summary: "Start a durable agent session",
    description:
      "The exact eve session protocol the Notra dashboard uses, proxied through API auth. Point any eve client (eve/client, useEveAgent) at /v2 as its host with your API key as a bearer token. Returns the session id and continuation token; stream events from GET /v2/eve/v1/session/{sessionId}/stream.",
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: createAgentSessionRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Session created",
        content: {
          "application/json": { schema: createAgentSessionResponseSchema },
        },
      },
      400: errorResponse("Invalid request body"),
      429: chatRateLimitResponse,
      500: errorResponse("Failed to check usage limits"),
      502: errorResponse("Agent session creation failed"),
      ...commonErrorResponses,
    },
  })
);

agentChatsRoutes.post("/eve/v1/session", async (c) => {
  const log = c.get("log");
  log.set({ feature: "agent_session" });
  const context = await requireAgentContext(c);
  if (!context.ok) {
    return context.response;
  }
  log.set({ organizationId: context.organizationId });
  const credits = await checkAgentAiCredits(context.organizationId);
  if (!credits.allowed) {
    return c.json({ error: credits.error, code: credits.code }, credits.status);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = createAgentSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  try {
    const client = await createAgentClient({
      organizationId: context.organizationId,
      userId: context.userId ?? undefined,
      useMarkup: credits.useMarkup,
      chargeAiCredits: credits.chargeAiCredits,
    });
    const created = await createAgentSessionWithMapping({
      fetchUpstream: (path, init) => client.fetch(path, init),
      scope: {
        organizationId: context.organizationId,
        userId: context.userId ?? undefined,
        surface: "standalone-chat",
      },
      message: parsed.data.message,
    });
    log.set({ sessionId: created.eveSessionId });
    log.audit({
      action: "agent.session.created",
      actor: {
        type: "api",
        id: c.get("auth").keyId ?? context.organizationId,
      },
      target: { type: "agent_session", id: created.eveSessionId },
      outcome: "success",
    });
    return c.json(
      {
        ok: true,
        sessionId: created.eveSessionId,
      },
      200,
      { "x-eve-session-id": created.eveSessionId }
    );
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      errorCode: "agent_session_create_failed",
    });
    return c.json({ error: "Agent session creation failed" }, 502);
  }
});

agentChatsRoutes.openAPIRegistry.registerPath(
  createRoute({
    method: "post",
    path: "/eve/v1/session/{sessionId}",
    tags: ["Agent"],
    operationId: "sendAgentSessionMessage",
    summary: "Send a follow-up message or answer a pending input request",
    description:
      "Sends the next turn of an agent session. The server binds the session's stored continuation token, so the client-provided one is ignored. Answer input.requested events (tool approvals, questions) from the event stream via inputResponses.",
    request: {
      params: agentSessionParamsSchema,
      body: {
        required: true,
        content: {
          "application/json": { schema: sendAgentMessageRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description:
          "Upstream eve response with the next continuation token for this session.",
        content: {
          "application/json": { schema: { type: "object" as const } },
        },
      },
      400: errorResponse("Invalid request body"),
      404: errorResponse("Session not found"),
      409: errorResponse("A message is already being processed"),
      429: chatRateLimitResponse,
      500: errorResponse("Failed to check usage limits"),
      ...commonErrorResponses,
    },
  })
);

// evlog-map-disable-next-line audit -- audited on session creation
agentChatsRoutes.post("/eve/v1/session/:sessionId", async (c) => {
  const log = c.get("log");
  log.set({ feature: "agent_session_message" });
  const context = await requireAgentContext(c);
  if (!context.ok) {
    return context.response;
  }
  const sessionId = c.req.param("sessionId");
  log.set({ organizationId: context.organizationId, sessionId });
  const mapping = await getAgentSessionMapping(
    context.organizationId,
    sessionId
  );
  if (!(mapping && canAccessSession(mapping, context.userId))) {
    return c.json({ error: "Session not found" }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = sendAgentMessageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (!(parsed.data.message || parsed.data.inputResponses?.length)) {
    return c.json({ error: "Invalid request body" }, 400);
  }
  const credits = await checkAgentAiCredits(context.organizationId);
  if (!credits.allowed) {
    return c.json({ error: credits.error, code: credits.code }, credits.status);
  }

  const client = await createAgentClient({
    organizationId: context.organizationId,
    userId: mapping.userId ?? undefined,
    chatId: mapping.chatId ?? undefined,
    useMarkup: credits.useMarkup,
    chargeAiCredits: credits.chargeAiCredits,
  });
  try {
    return await forwardAgentFollowUp({
      fetchUpstream: (path, init) => client.fetch(path, init),
      eveSessionId: sessionId,
      message: parsed.data.message,
      inputResponses: parsed.data.inputResponses,
    });
  } catch (error) {
    if (error instanceof AgentSendLockedError) {
      return c.json(
        { error: "A message is already being processed for this session" },
        409
      );
    }
    throw error;
  }
});

agentChatsRoutes.openAPIRegistry.registerPath(
  createRoute({
    method: "get",
    path: "/eve/v1/session/{sessionId}/stream",
    tags: ["Agent"],
    operationId: "streamAgentSessionEvents",
    summary: "Stream an agent session's events",
    description:
      "Durable, replayable eve session event stream (newline-delimited JSON). Pass startIndex to resume from a known position. Includes input.requested events for tool approvals.",
    request: { params: agentSessionParamsSchema },
    responses: {
      200: {
        description: "NDJSON event stream",
        content: {
          "application/x-ndjson": { schema: { type: "string" as const } },
        },
      },
      404: errorResponse("Session not found"),
      429: chatRateLimitResponse,
      ...commonErrorResponses,
    },
  })
);

// evlog-map-disable-next-line audit -- audited on session creation
agentChatsRoutes.get("/eve/v1/session/:sessionId/stream", async (c) => {
  const log = c.get("log");
  log.set({ feature: "agent_session_stream" });
  const context = await requireAgentContext(c);
  if (!context.ok) {
    return context.response;
  }
  const sessionId = c.req.param("sessionId");
  log.set({ organizationId: context.organizationId, sessionId });
  const mapping = await getAgentSessionMapping(
    context.organizationId,
    sessionId
  );
  if (!(mapping && canAccessSession(mapping, context.userId))) {
    return c.json({ error: "Session not found" }, 404);
  }

  const client = await createAgentClient({
    organizationId: context.organizationId,
  });
  return await forwardAgentStream({
    fetchUpstream: (path, init) => client.fetch(path, init),
    eveSessionId: sessionId,
    startIndex: c.req.query("startIndex"),
  });
});

const listAgentChatsRoute = createRoute({
  method: "get",
  path: "/agent-chats",
  tags: ["Agent"],
  operationId: "listAgentChats",
  summary: "List agent sessions",
  request: { query: listAgentChatsQuerySchema },
  responses: {
    200: {
      description: "Agent sessions fetched successfully",
      content: {
        "application/json": { schema: listAgentChatsResponseSchema },
      },
    },
    429: chatRateLimitResponse,
    ...commonErrorResponses,
  },
});

agentChatsRoutes.openapi(listAgentChatsRoute, async (c) => {
  const context = await requireAgentContext(c);
  if (!context.ok) {
    return context.response;
  }
  const { limit } = c.req.valid("query");
  const sessions = await listAgentSessionMappings(
    context.organizationId,
    limit,
    context.userId
  );
  return c.json(
    {
      sessions: sessions.map((session) => ({
        sessionId: session.eveSessionId,
        chatId: session.chatId,
        surface: session.surface,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      })),
    },
    200
  );
});
