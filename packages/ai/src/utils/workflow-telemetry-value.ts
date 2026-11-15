import {
  WORKFLOW_TELEMETRY_COUNTS,
  WORKFLOW_TELEMETRY_ENUMS,
  WORKFLOW_TELEMETRY_FLAGS,
  WORKFLOW_TELEMETRY_IDENTIFIERS,
} from "@notra/ai/constants/workflow-telemetry";
import { telemetryValue } from "@notra/ai/utils/telemetry-value";

export function workflowTelemetryValue(key: string, value: unknown): boolean {
  if (WORKFLOW_TELEMETRY_IDENTIFIERS.has(key)) {
    return telemetryValue("requestId", value);
  }
  if (WORKFLOW_TELEMETRY_COUNTS.has(key)) {
    return (
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    );
  }
  if (WORKFLOW_TELEMETRY_FLAGS.has(key)) {
    return typeof value === "boolean";
  }
  if (key === "queueWaitMs") {
    return telemetryValue("durationMs", value);
  }
  const choices = Object.hasOwn(WORKFLOW_TELEMETRY_ENUMS, key)
    ? WORKFLOW_TELEMETRY_ENUMS[key]
    : undefined;
  return typeof value === "string" && Boolean(choices?.has(value));
}
