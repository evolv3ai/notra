import {
  ENV_SWITCH_OFF_VALUES,
  ENV_SWITCH_ON_VALUES,
} from "@notra/ai/constants/env-switch";

/**
 * Reads an on/off env switch. Accepts off/false/0/disabled and
 * on/true/1/enabled (case-insensitive, trimmed); anything else, including
 * unset, falls back to `defaultOn`.
 */
export function readEnvSwitch(
  name: string,
  { defaultOn }: { defaultOn: boolean }
): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw && ENV_SWITCH_OFF_VALUES.has(raw)) {
    return false;
  }
  if (raw && ENV_SWITCH_ON_VALUES.has(raw)) {
    return true;
  }
  return defaultOn;
}
