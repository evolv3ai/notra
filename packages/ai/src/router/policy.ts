import { GATEWAY_FALLBACK_ORDER } from "@notra/ai/constants/router";
import type {
  DecideGatewayInput,
  GatewayDecision,
  GatewayId,
} from "@notra/ai/types/router";

/**
 * Pure routing decision. No I/O, no adapter knowledge — the resolver applies
 * availability and compliance checks on top of this.
 */
export function decideGateway(input: DecideGatewayInput): GatewayDecision {
  const { policy, organizationId, plan, pinned } = input;

  if (pinned) {
    return { gateway: pinned, reason: "pinned" };
  }

  if (!organizationId) {
    return { gateway: policy.defaultGateway, reason: "no-org-default" };
  }

  if (plan === "paid") {
    return { gateway: policy.paidGateway, reason: "paid" };
  }

  return { gateway: policy.freeGateway, reason: "free" };
}

export function fallbackGateways(gateway: GatewayId): GatewayId[] {
  return GATEWAY_FALLBACK_ORDER.filter((candidate) => candidate !== gateway);
}
