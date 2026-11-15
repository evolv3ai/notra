import {
  TELEMETRY_AI_FIELDS,
  TELEMETRY_EVENT_ENUM_FIELDS,
  TELEMETRY_EVENT_FIELDS,
  TELEMETRY_GEO_INGEST_RUNTIME_COUNT_FIELDS,
  TELEMETRY_GEO_INGEST_RUNTIME_FIELDS,
  TELEMETRY_PROVIDER_ALIASES,
  TELEMETRY_UPSTREAM_PROVIDER_ALIASES,
} from "@notra/ai/constants/telemetry";
import { WORKFLOW_TELEMETRY_FIELDS } from "@notra/ai/constants/workflow-telemetry";
import { telemetryValue } from "@notra/ai/utils/telemetry-value";
import { workflowTelemetryValue } from "@notra/ai/utils/workflow-telemetry-value";
import { isRecord } from "@notra/utils/unknown-record";
import type { WideEvent } from "evlog";

/** A second telemetry destination gets an explicit, content-free field set. */
export function telemetryEvent(event: WideEvent): WideEvent {
  const safe: Record<string, unknown> = {};
  for (const key of TELEMETRY_EVENT_FIELDS) {
    const aliases =
      key === "provider"
        ? TELEMETRY_PROVIDER_ALIASES
        : TELEMETRY_UPSTREAM_PROVIDER_ALIASES;
    let value = event[key];
    if (
      (key === "provider" || key === "upstreamProvider") &&
      typeof value === "string" &&
      Object.hasOwn(aliases, value)
    ) {
      value = aliases[value];
    }
    if (telemetryValue(key, value)) {
      safe[key] = value;
    }
  }
  const eventEnums =
    typeof event.event === "string" &&
    Object.hasOwn(TELEMETRY_EVENT_ENUM_FIELDS, event.event)
      ? TELEMETRY_EVENT_ENUM_FIELDS[event.event]
      : undefined;
  for (const [key, choices] of Object.entries(eventEnums ?? {})) {
    delete safe[key];
    const value = event[key];
    if (typeof value === "string" && choices.has(value)) {
      safe[key] = value;
    }
  }
  if (event.event === "geo.ingest.runtime") {
    for (const key of TELEMETRY_GEO_INGEST_RUNTIME_FIELDS) {
      const value = event[key];
      if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        (!TELEMETRY_GEO_INGEST_RUNTIME_COUNT_FIELDS.has(key) ||
          Number.isSafeInteger(value))
      ) {
        safe[key] = value;
      }
    }
  }
  if (
    typeof event.event === "string" &&
    Object.hasOwn(WORKFLOW_TELEMETRY_FIELDS, event.event)
  ) {
    for (const key of WORKFLOW_TELEMETRY_FIELDS[event.event] ?? []) {
      delete safe[key];
      if (workflowTelemetryValue(key, event[key])) {
        safe[key] = event[key];
      }
    }
  }
  const { ai } = event;
  if (isRecord(ai)) {
    safe.ai = Object.fromEntries(
      TELEMETRY_AI_FIELDS.flatMap((key) => {
        const value = ai[key];
        return telemetryValue(key, value) ? [[key, value]] : [];
      })
    );
  }
  return safe as WideEvent;
}
