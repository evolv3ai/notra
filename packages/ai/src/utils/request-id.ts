import { telemetryValue } from "@notra/ai/utils/telemetry-value";

export function resolveRequestId(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      telemetryValue("requestId", candidate)
    ) {
      return candidate;
    }
  }
  return crypto.randomUUID();
}
