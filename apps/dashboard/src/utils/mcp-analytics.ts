import type { McpToolNeighbor } from "@notra/geo-core/types/mcp-analytics";

import type { MCP_ELICITATION_OUTCOME_VARIANTS } from "@/constants/mcp-analytics";

export function percentChange(current: number, previous: number): number {
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

export function errorRate(errors: number, requests: number): number {
  return requests === 0 ? 0 : (errors / requests) * 100;
}

export function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function failureRecovery(tool: string, after: McpToolNeighbor[]) {
  const retries = after.find((hop) => hop.tool === tool)?.afterFailure ?? 0;
  const switches = after.filter(
    (hop) => hop.tool !== tool && hop.tool !== "" && hop.afterFailure > 0
  );
  const gaveUp = after.find((hop) => hop.tool === "")?.afterFailure ?? 0;
  return { retries, switches, gaveUp };
}

export function sessionDurationSeconds(startedAt: string, endedAt: string) {
  return Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)
  );
}

export function acceptRate(accepted: number, requests: number): number {
  return requests > 0 ? (accepted / requests) * 100 : 0;
}

export function elicitationOutcome(
  value: string | undefined
): keyof typeof MCP_ELICITATION_OUTCOME_VARIANTS | null {
  if (value === "accept" || value === "decline" || value === "cancel") {
    return value;
  }
  return null;
}
