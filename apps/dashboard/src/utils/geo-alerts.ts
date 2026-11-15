import type {
  GeoChangeEvent,
  GeoScanCheckSnapshot,
  GeoScanDiff,
} from "@notra/geo-core/types/geo";
import {
  engineFamilyLabel,
  engineFamilyOf,
} from "@notra/geo-core/utils/geo-engine-family";
import {
  GEO_ALERT_DEFAULT_THRESHOLDS,
  type GeoAlertSourceConfig,
} from "@notra/schemas/dashboard/automation/geo-alerts";

import {
  GEO_ALERT_AUTOMATION_MAX_CHANGES,
  GEO_ALERT_AUTOMATION_MIN_PAIRS,
  GEO_ALERT_AUTOMATION_PREVIEW_CHANGES,
  GEO_ALERT_AUTOMATION_PROMPT_MAX_LENGTH,
  GEO_ALERT_SIGNAL_CHANGE_KINDS,
} from "@/constants/geo-alert-automations";
import type {
  GeoAlertChangeItem,
  GeoAlertMatch,
} from "@/types/automation/geo-alerts";
import { formatPoints, formatRate, truncatePrompt } from "@/utils/geo-recap";

function pairKey(check: Pick<GeoScanCheckSnapshot, "promptId" | "engine">) {
  return `${check.promptId}\u0000${check.engine}`;
}

/**
 * Mention rate over the prompt × engine pairs both scans answered, so a scan
 * that added or dropped prompts can't fake a swing. `null` below the noise
 * floor.
 */
function pairedVisibility(diff: Pick<GeoScanDiff, "previous" | "current">) {
  const previousByKey = new Map(
    diff.previous.map((check) => [pairKey(check), check] as const)
  );
  let pairs = 0;
  let before = 0;
  let after = 0;
  for (const check of diff.current) {
    const previous = previousByKey.get(pairKey(check));
    if (!previous) {
      continue;
    }
    pairs += 1;
    before += Number(previous.mentioned);
    after += Number(check.mentioned);
  }
  if (pairs < GEO_ALERT_AUTOMATION_MIN_PAIRS) {
    return null;
  }
  const previousRate = before / pairs;
  const currentRate = after / pairs;
  return {
    pairs,
    previousRate,
    currentRate,
    points: Math.round((currentRate - previousRate) * 100),
  };
}

function currentVisibility(current: readonly GeoScanCheckSnapshot[]) {
  if (current.length === 0) {
    return null;
  }
  return current.filter((check) => check.mentioned).length / current.length;
}

function joinNames(names: readonly string[]) {
  if (names.length <= 2) {
    return names.join(" and ");
  }
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

function describeGeoChange(event: GeoChangeEvent): string {
  const names = joinNames(event.competitors);
  switch (event.kind) {
    case "lost_mention":
      return "No longer mentioned";
    case "competitor_displaced":
      return event.current.mentioned
        ? `Pushed down by ${names}`
        : `${names} took your spot`;
    case "competitor_cited":
      return `${names} now cited`;
    case "citation_removed":
      return "Your site is no longer cited";
    case "citation_added":
      return "Your site is now cited";
    case "gained_mention":
      return "Now mentioned";
    case "position_improved":
      return "Ranked higher";
    case "position_dropped":
      return "Ranked lower";
    case "new_engine":
      return "New engine";
    default:
      return event.kind;
  }
}

function toChangeItem(event: GeoChangeEvent): GeoAlertChangeItem {
  return {
    prompt: truncatePrompt(
      event.prompt,
      GEO_ALERT_AUTOMATION_PROMPT_MAX_LENGTH
    ),
    engine: engineFamilyLabel(engineFamilyOf(event.engine)),
    engineId: event.engine,
    engineFamily: engineFamilyOf(event.engine),
    kind: event.kind,
    competitors: event.competitors,
    detail: describeGeoChange(event),
  };
}

function changeList(events: readonly GeoChangeEvent[]) {
  return {
    changes: events
      .slice(0, GEO_ALERT_AUTOMATION_MAX_CHANGES)
      .map(toChangeItem),
    totalChanges: events.length,
  };
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function signalEvents(
  signal: keyof typeof GEO_ALERT_SIGNAL_CHANGE_KINDS,
  events: readonly GeoChangeEvent[]
) {
  const kinds = GEO_ALERT_SIGNAL_CHANGE_KINDS[signal];
  return events.filter((event) => {
    if (!kinds.includes(event.kind)) {
      return false;
    }
    // A displacement only counts as a lost mention when you dropped out.
    if (signal === "mention_lost" && event.kind === "competitor_displaced") {
      return !event.current.mentioned;
    }
    return true;
  });
}

function thresholdOf(config: GeoAlertSourceConfig) {
  return config.threshold ?? GEO_ALERT_DEFAULT_THRESHOLDS[config.signal] ?? 1;
}

function competitorNames(events: readonly GeoChangeEvent[]) {
  return [...new Set(events.flatMap((event) => event.competitors))];
}

/**
 * Decides whether one alert automation fires for a finished scan. Pure, so
 * the thresholds can be tested without a database.
 */
export function matchGeoAlert(
  config: GeoAlertSourceConfig,
  diff: GeoScanDiff,
  companyName: string
): GeoAlertMatch | null {
  const threshold = thresholdOf(config);
  switch (config.signal) {
    case "visibility_drop": {
      const visibility = pairedVisibility(diff);
      if (!visibility || -visibility.points < threshold) {
        return null;
      }
      const lost = signalEvents("mention_lost", diff.events);
      return {
        signal: config.signal,
        title: `AI visibility dropped ${Math.abs(visibility.points)} pts for ${companyName}`,
        summary: `Mentioned in ${formatRate(visibility.currentRate)} of answers, down from ${formatRate(visibility.previousRate)} in the previous scan.`,
        ...changeList(lost),
      };
    }
    case "mention_lost": {
      const lost = signalEvents(config.signal, diff.events);
      if (lost.length < threshold) {
        return null;
      }
      return {
        signal: config.signal,
        title: `${companyName} dropped out of ${plural(lost.length, "AI answer")}`,
        summary: `${plural(lost.length, "prompt")} mentioned you in the previous scan and no longer do.`,
        ...changeList(lost),
      };
    }
    case "competitor_gain": {
      const gained = signalEvents(config.signal, diff.events);
      if (gained.length < threshold) {
        return null;
      }
      const names = competitorNames(gained);
      return {
        signal: config.signal,
        title: `${joinNames(names)} gained ground on ${companyName}`,
        summary: `Competitors took your spot or got cited in ${plural(gained.length, "answer")} since the previous scan.`,
        ...changeList(gained),
      };
    }
    case "citation_lost": {
      const removed = signalEvents(config.signal, diff.events);
      if (removed.length < threshold) {
        return null;
      }
      return {
        signal: config.signal,
        title: `${companyName} lost ${plural(removed.length, "citation")}`,
        summary: `AI answers stopped linking to your site for ${plural(removed.length, "prompt")}.`,
        ...changeList(removed),
      };
    }
    case "scan_summary": {
      const visibility = pairedVisibility(diff);
      const rate = visibility?.currentRate ?? currentVisibility(diff.current);
      const gained = diff.events.filter((e) => e.kind === "gained_mention");
      const lost = signalEvents("mention_lost", diff.events);
      const parts = [
        `Visibility ${formatRate(rate)}${visibility ? ` (${formatPoints(visibility.points)})` : ""}`,
        `${gained.length} gained`,
        `${lost.length} lost`,
        `${plural(diff.current.length, "answer")} checked`,
      ];
      return {
        signal: config.signal,
        title: `GEO scan finished for ${companyName}`,
        summary: `${parts.join(" · ")}.`,
        ...changeList([...lost, ...gained]),
      };
    }
    case "scan_failed":
      return null;
    default: {
      const unexpected: never = config.signal;
      return unexpected;
    }
  }
}

export function failedScanMatch(
  companyName: string,
  reason: string | undefined
): GeoAlertMatch {
  return {
    signal: "scan_failed",
    title: `GEO scan failed for ${companyName}`,
    summary: reason
      ? `The scan stopped: ${reason}`
      : "The scan finished without a single successful check.",
    changes: [],
    totalChanges: 0,
  };
}

function escapeSlack(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Plain mrkdwn for `chat.postMessage`, readable in notifications too. */
export function formatGeoAlertSlackText(
  match: GeoAlertMatch,
  automationName: string,
  url: string
) {
  const lines = [`*${escapeSlack(match.title)}*`, escapeSlack(match.summary)];
  const preview = match.changes.slice(0, GEO_ALERT_AUTOMATION_PREVIEW_CHANGES);
  for (const change of preview) {
    lines.push(
      `• ${escapeSlack(change.prompt)} (${escapeSlack(change.engine)}): ${escapeSlack(change.detail)}`
    );
  }
  const remaining = match.totalChanges - preview.length;
  if (remaining > 0) {
    lines.push(`…and ${remaining} more`);
  }
  lines.push(`<${url}|Open in Notra> · ${escapeSlack(automationName)}`);
  return lines.join("\n");
}
