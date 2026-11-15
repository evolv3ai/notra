import {
  GATEWAY_LIMIT_ALERT,
  GATEWAY_LIMIT_DESCRIPTIONS,
} from "@notra/ai/constants/evlog";
import type { WideEvent } from "evlog";

export function gatewayLimitMessage(
  event: WideEvent,
  environment: string
): string {
  const description = Object.hasOwn(
    GATEWAY_LIMIT_DESCRIPTIONS,
    String(event.limitType)
  )
    ? GATEWAY_LIMIT_DESCRIPTIONS[
        event.limitType as keyof typeof GATEWAY_LIMIT_DESCRIPTIONS
      ]
    : GATEWAY_LIMIT_DESCRIPTIONS.unknown;
  return [
    "AI gateway limit hit",
    `Environment: ${environment}`,
    `Gateway: ${event.gateway}`,
    `HTTP status: ${event.status}`,
    `Limit: ${description.name}`,
    `Reason: ${description.reason}`,
    ...(event.limitType === "daily-spend" || event.limitType === "daily-tokens"
      ? ["Daily cap amount: not reported by the provider."]
      : []),
    ...(typeof event.requestLimit === "number"
      ? [`Request rate allowance: ${event.requestLimit}`]
      : []),
    ...(typeof event.tokenLimit === "number"
      ? [`Token rate allowance: ${event.tokenLimit}`]
      : []),
    event.limitType === "credit-balance"
      ? "Reset: no timed reset reported; adding credits may be required."
      : `Reset: ${event.rateLimitResetAt ?? "exact time not reported by the provider"}`,
    event.retryAt
      ? `Retry-After: ${event.retryAfterSeconds}s; retry at ${event.retryAt} (provider guidance, not a confirmed reset).`
      : "Retry-After: not reported by the provider.",
    `Action: ${description.recovery}`,
    `Model: ${event.model}`,
    `Call: ${event.callId}`,
    ...(event.organizationId ? [`Organization: ${event.organizationId}`] : []),
    ...(event.projectId ? [`Project: ${event.projectId}`] : []),
    "Fallback may still succeed; this alert does not confirm recovery.",
    `Repeated alerts for this gateway/status/limit type stay muted until there have been ${GATEWAY_LIMIT_ALERT.dedupeSeconds / 60} minutes without another matching failure. Full logs are retained.`,
  ].join("\n");
}
