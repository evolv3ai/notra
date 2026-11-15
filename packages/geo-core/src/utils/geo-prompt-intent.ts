import { GEO_PROMPT_INTENT_RULES } from "../constants/geo";
import type { GeoPromptIntent } from "../types/geo";

export function geoPromptIntent(text: string): GeoPromptIntent {
  const normalized = text.trim();
  if (normalized.length === 0) {
    return "other";
  }
  for (const rule of GEO_PROMPT_INTENT_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.intent;
    }
  }
  return "other";
}
