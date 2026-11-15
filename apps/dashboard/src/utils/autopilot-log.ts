import { AUTOPILOT_TRACE_TEXT_MAX_CHARS } from "@/constants/autopilot";
import {
  AUTOPILOT_SECRET_FIELD,
  AUTOPILOT_SECRET_VALUE,
} from "@/constants/autopilot-observability";

/** Defense in depth, not a guarantee that arbitrary source text is public. */
export function redactAutopilotTraceDetail(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(AUTOPILOT_SECRET_VALUE, "[redacted]");
  }
  if (Array.isArray(value)) {
    return value.map(redactAutopilotTraceDetail);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        AUTOPILOT_SECRET_FIELD.test(key)
          ? "[redacted]"
          : redactAutopilotTraceDetail(entry),
      ])
    );
  }
  return value;
}

/** Long strings are clipped so one trace never bloats a row. */
export function clipAutopilotTraceDetail(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > AUTOPILOT_TRACE_TEXT_MAX_CHARS
      ? `${value.slice(0, AUTOPILOT_TRACE_TEXT_MAX_CHARS)}… (${value.length} chars)`
      : value;
  }
  if (Array.isArray(value)) {
    return value.map(clipAutopilotTraceDetail);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        clipAutopilotTraceDetail(entry),
      ])
    );
  }
  return value;
}
