import {
  AUTOPILOT_RULE_PREFIX,
  AUTOPILOT_RULE_TRAILING_PUNCTUATION,
} from "@/constants/autopilot";

/**
 * "dependency bumps" becomes "Never suggest posts about dependency bumps"; a
 * typed "Never …" rule stays as written. Null when too short to save.
 */
export function toAutopilotRuleText(topic: string) {
  const text = topic.trim().replace(AUTOPILOT_RULE_TRAILING_PUNCTUATION, "");
  if (text.length < 3) {
    return null;
  }
  return /^never\s/i.test(text) ? text : `${AUTOPILOT_RULE_PREFIX} ${text}`;
}
