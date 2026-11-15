import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import type { AgentReadinessScoreBandKey } from "@notra/geo-core/types/agent-readiness";
import { TREND_BADGE_APPEARANCES } from "@notra/ui/constants/trend-badge";

export const AGENT_READINESS_CHANGE_ROW_ORDER = [
  "worsened",
  "added",
  "improved",
  "resolved",
] as const;

export const AGENT_READINESS_CHANGE_ICONS = {
  worsened: TREND_BADGE_APPEARANCES.down.icon,
  added: AlertCircleIcon,
  improved: TREND_BADGE_APPEARANCES.up.icon,
  resolved: CheckmarkCircle01Icon,
} as const;

export const AGENT_READINESS_CHANGE_TONE_CLASSES = {
  worsened: TREND_BADGE_APPEARANCES.down.foreground,
  added: TREND_BADGE_APPEARANCES.down.foreground,
  improved: TREND_BADGE_APPEARANCES.up.foreground,
  resolved: TREND_BADGE_APPEARANCES.up.foreground,
} as const;

export const AGENT_READINESS_CHANGES_DEFAULT_SORT = {
  key: "change",
  direction: "asc",
} as const;

export const AGENT_READINESS_BAND_TEXT_CLASS = {
  great: "text-emerald-500",
  "needs-improvement": "text-amber-500",
  poor: "text-red-500",
} as const satisfies Record<AgentReadinessScoreBandKey, string>;

export const AGENT_READINESS_BAND_BG_CLASS = {
  great: "bg-emerald-500",
  "needs-improvement": "bg-amber-500",
  poor: "bg-red-500",
} as const satisfies Record<AgentReadinessScoreBandKey, string>;
