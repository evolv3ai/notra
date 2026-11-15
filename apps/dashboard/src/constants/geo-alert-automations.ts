import type { GeoChangeKind } from "@notra/geo-core/types/geo";
import type { GeoAlertSignal } from "@notra/schemas/dashboard/automation/geo-alerts";

/** Changes kept on a fired alert; the webhook payload carries all of them. */
export const GEO_ALERT_AUTOMATION_MAX_CHANGES = 20;
/** Changes listed in Slack and email before "and N more". */
export const GEO_ALERT_AUTOMATION_PREVIEW_CHANGES = 5;
/** Below this many prompt × engine pairs in both scans a rate swing is noise. */
export const GEO_ALERT_AUTOMATION_MIN_PAIRS = 5;
export const GEO_ALERT_AUTOMATION_PROMPT_MAX_LENGTH = 80;

export const GEO_ALERT_SIGNAL_CHANGE_KINDS: Record<
  "mention_lost" | "competitor_gain" | "citation_lost",
  readonly GeoChangeKind[]
> = {
  mention_lost: ["lost_mention", "competitor_displaced"],
  competitor_gain: ["competitor_displaced", "competitor_cited"],
  citation_lost: ["citation_removed"],
};

/** Where "Open in Notra" lands for each signal, below `/{slug}`. */
export const GEO_ALERT_SIGNAL_PATHS: Record<GeoAlertSignal, string> = {
  visibility_drop: "/geo",
  mention_lost: "/geo/prompts",
  competitor_gain: "/geo/competitors",
  citation_lost: "/geo/shelf-space",
  scan_failed: "/geo/settings",
  scan_summary: "/geo",
};
