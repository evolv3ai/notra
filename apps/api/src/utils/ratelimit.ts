import { CHAT_GENERATION_RATE_LIMIT } from "@notra/ai/constants/rate-limits";
import {
  AGENT_FEEDBACK_RATE_LIMIT_IP_WINDOW_LABEL,
  AGENT_FEEDBACK_RATE_LIMIT_IP_WINDOW_MINUTES,
  AGENT_FEEDBACK_RATE_LIMIT_ORGANIZATION_WINDOW_LABEL,
  AGENT_FEEDBACK_RATE_LIMIT_ORGANIZATION_WINDOW_MINUTES,
  AGENT_FEEDBACK_RATE_LIMIT_PER_IP,
  AGENT_FEEDBACK_RATE_LIMIT_PER_ORGANIZATION,
} from "@notra/db/constants/agent-feedback";
import { getClientIp, getClientNetworkKey } from "@notra/utils/client-ip";
import { isDemoMode } from "@notra/utils/demo-mode";
import { createLimiter, getRateLimitHeaders } from "@notra/utils/ratelimit";
import type { Limiter } from "@notra/utils/types/ratelimit";
import type { Context } from "hono";

import { trackApiRateLimited } from "./analytics";
import { getOrganizationId } from "./auth";

export const RATE_LIMITS = {
  postGeneration: { requests: 10, window: "1 minute" },
  brandGeneration: { requests: 5, window: "1 minute" },
  chatGeneration: {
    requests: CHAT_GENERATION_RATE_LIMIT.requests,
    window: CHAT_GENERATION_RATE_LIMIT.windowLabel,
  },
  integrationCreate: { requests: 20, window: "1 minute" },
  postUpdate: { requests: 60, window: "1 minute" },
  feedbackIngest: { requests: 120, window: "1 minute" },
  feedbackIngestIp: {
    requests: AGENT_FEEDBACK_RATE_LIMIT_PER_IP,
    window: AGENT_FEEDBACK_RATE_LIMIT_IP_WINDOW_LABEL,
  },
  feedbackIngestOrganization: {
    requests: AGENT_FEEDBACK_RATE_LIMIT_PER_ORGANIZATION,
    window: AGENT_FEEDBACK_RATE_LIMIT_ORGANIZATION_WINDOW_LABEL,
  },
  scanTrigger: { requests: 4, window: "1 hour" },
  sequenceRun: { requests: 10, window: "10 minutes" },
  promptImport: { requests: 10, window: "10 minutes" },
  competitorImport: { requests: 10, window: "10 minutes" },
  competitorSuggestions: { requests: 10, window: "10 minutes" },
  writerPlan: { requests: 10, window: "10 minutes" },
  writerApprove: { requests: 20, window: "10 minutes" },
  agentReadinessScan: { requests: 10, window: "1 hour" },
  publicStatus: { requests: 120, window: "1 minute" },
} as const;

export const ratelimit = {
  postGeneration: createLimiter({
    prefix: "ratelimit:api:post-generation",
    requests: RATE_LIMITS.postGeneration.requests,
    window: "1m",
  }),
  brandGeneration: createLimiter({
    prefix: "ratelimit:api:brand-generation",
    requests: RATE_LIMITS.brandGeneration.requests,
    window: "1m",
  }),
  chatGeneration: createLimiter({
    prefix: "ratelimit:chat-generation",
    requests: CHAT_GENERATION_RATE_LIMIT.requests,
    window: CHAT_GENERATION_RATE_LIMIT.window,
  }),
  integrationCreate: createLimiter({
    prefix: "ratelimit:api:integration-create",
    requests: RATE_LIMITS.integrationCreate.requests,
    window: "1m",
  }),
  postUpdate: createLimiter({
    prefix: "ratelimit:api:post-update",
    requests: RATE_LIMITS.postUpdate.requests,
    window: "1m",
  }),
  feedbackIngest: createLimiter({
    prefix: "ratelimit:api:feedback-ingest",
    requests: RATE_LIMITS.feedbackIngest.requests,
    window: "1m",
  }),
  feedbackIngestIp: createLimiter({
    prefix: "ratelimit:api:feedback-ingest-ip",
    requests: RATE_LIMITS.feedbackIngestIp.requests,
    window: `${AGENT_FEEDBACK_RATE_LIMIT_IP_WINDOW_MINUTES}m`,
  }),
  feedbackIngestOrganization: createLimiter({
    prefix: "ratelimit:api:feedback-ingest-organization",
    requests: RATE_LIMITS.feedbackIngestOrganization.requests,
    window: `${AGENT_FEEDBACK_RATE_LIMIT_ORGANIZATION_WINDOW_MINUTES}m`,
  }),
  scanTrigger: createLimiter({
    prefix: "ratelimit:api:geo-scan-trigger",
    requests: RATE_LIMITS.scanTrigger.requests,
    window: "1h",
  }),
  sequenceRun: createLimiter({
    prefix: "ratelimit:api:geo-sequence-run",
    requests: RATE_LIMITS.sequenceRun.requests,
    window: "10m",
  }),
  promptImport: createLimiter({
    prefix: "ratelimit:api:geo-prompt-import",
    requests: RATE_LIMITS.promptImport.requests,
    window: "10m",
  }),
  competitorImport: createLimiter({
    prefix: "ratelimit:api:geo-competitor-import",
    requests: RATE_LIMITS.competitorImport.requests,
    window: "10m",
  }),
  competitorSuggestions: createLimiter({
    prefix: "ratelimit:api:geo-competitor-suggestions",
    requests: RATE_LIMITS.competitorSuggestions.requests,
    window: "10m",
  }),
  writerPlan: createLimiter({
    prefix: "ratelimit:api:geo-writer-plan",
    requests: RATE_LIMITS.writerPlan.requests,
    window: "10m",
  }),
  writerApprove: createLimiter({
    prefix: "ratelimit:api:geo-writer-approve",
    requests: RATE_LIMITS.writerApprove.requests,
    window: "10m",
  }),
  agentReadinessScan: createLimiter({
    prefix: "ratelimit:api:geo-agent-readiness-scan",
    requests: RATE_LIMITS.agentReadinessScan.requests,
    window: "1h",
  }),
  publicStatus: createLimiter({
    prefix: "ratelimit:api:public-status",
    requests: RATE_LIMITS.publicStatus.requests,
    window: "1m",
  }),
};

type RatelimitScope = "credential" | "organization" | "ip";

function getClientIpKey(c: Context): string {
  const headers = c.req.raw.headers;
  return (
    (isDemoMode() ? getClientNetworkKey(headers) : getClientIp(headers)) ??
    "unknown"
  );
}

function getRatelimitKey(c: Context, scope: RatelimitScope): string {
  if (scope === "ip") {
    return getClientIpKey(c);
  }

  const auth = c.get("auth");
  if (auth) {
    if (scope === "organization") {
      const organizationId = getOrganizationId(c);
      if (organizationId) {
        return organizationId;
      }
    }

    if (auth.keyId) {
      return auth.keyId;
    }
  }

  return getClientIpKey(c);
}

export function setRatelimitHeaders(
  c: Context,
  result: { limit: number; remaining: number; reset: number }
) {
  for (const [name, value] of getRateLimitHeaders(result)) {
    c.header(name, value);
  }
  return Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
}

export async function enforceRatelimitForKey(
  c: Context,
  limiter: Limiter,
  key: string
) {
  const result = await limiter.limit(key);
  const resetSeconds = setRatelimitHeaders(c, result);

  if (result.success) {
    return null;
  }

  c.header("Retry-After", String(resetSeconds));
  trackApiRateLimited(c, { limit: result.limit });

  return c.json(
    {
      error: "Rate limit exceeded",
      limit: result.limit,
      remaining: Math.max(0, result.remaining),
      reset: result.reset,
    },
    429
  );
}

export function enforceRatelimit(
  c: Context,
  limiter: Limiter,
  scope: RatelimitScope = "credential"
) {
  return enforceRatelimitForKey(c, limiter, getRatelimitKey(c, scope));
}
