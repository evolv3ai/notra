import { findNewActiveContent } from "@notra/ai/utils/github-mention-content-policy";
import type {
  GeoPromptGapRow,
  GeoSearchGapRow,
} from "@notra/geo-core/types/geo";
import { slugify } from "@notra/utils/slugify";

import {
  AUTOPILOT_BLOG_DIRECTORY_HINTS,
  AUTOPILOT_BLOG_SLUG_MAX_CHARS,
  AUTOPILOT_KEYWORD_MAX_MENTION_RATE,
  AUTOPILOT_MARKDOWN_FILE,
  AUTOPILOT_SEARCH_GAP_MIN_IMPRESSIONS,
} from "@/constants/autopilot";
import { normalizeRepositoryDirectory } from "@/utils/autopilot-paths";

export function autopilotBlogSlug(value: string) {
  return slugify(value).slice(0, AUTOPILOT_BLOG_SLUG_MAX_CHARS);
}

export function keywordFingerprint(keyword: string) {
  return `keyword:${autopilotBlogSlug(keyword)}`;
}

export function detectBlogDirectory(
  paths: string[],
  configured: string | null
) {
  const directory = configured && normalizeRepositoryDirectory(configured);
  if (directory) {
    return directory;
  }
  const markdown = paths.filter((path) => AUTOPILOT_MARKDOWN_FILE.test(path));
  return (
    AUTOPILOT_BLOG_DIRECTORY_HINTS.find((hint) =>
      markdown.some((path) => path.startsWith(`${hint}/`))
    ) ?? "content/blog"
  );
}

/** Reject executable MDX that wasn't present in the repository's sample. */
export function assertNoActiveContent(
  path: string,
  sample: string | null,
  next: string
) {
  const findings = findNewActiveContent({ path, previous: sample, next });
  if (findings.length > 0) {
    throw new Error(
      `The draft contains executable content Autopilot does not commit: ${findings.map((finding) => `${finding.reason} (${finding.line})`).join("; ")}`
    );
  }
}

export function pageToUpdate(
  recommendation: GeoSearchGapRow["recommendation"] | undefined
) {
  const page = recommendation?.targets[0];
  return recommendation?.action === "update" && page?.url
    ? { url: page.url, title: page.title }
    : null;
}

export function topQuery(gap: GeoSearchGapRow) {
  return [...gap.queries].sort((a, b) => b.impressions - a.impressions)[0];
}

export function promptGapDropReason(gap: GeoPromptGapRow) {
  if (gap.won) {
    return "You already win this prompt";
  }
  if (gap.brief) {
    return "A GEO brief exists for it";
  }
  if (gap.competitors.length === 0) {
    return "No competitor shows up either";
  }
  if (gap.ownMentionRate > AUTOPILOT_KEYWORD_MAX_MENTION_RATE) {
    return `You show up in ${Math.round(gap.ownMentionRate * 100)}% of answers (limit ${Math.round(AUTOPILOT_KEYWORD_MAX_MENTION_RATE * 100)}%)`;
  }
  return null;
}

export function searchGapDropReason(gap: GeoSearchGapRow) {
  if (gap.brief) {
    return "A GEO brief exists for it";
  }
  const action = gap.recommendation.action;
  if (action === "update" && !gap.recommendation.targets[0]?.url) {
    return "An existing page covers it, but it has no URL to update";
  }
  if (action !== "create" && action !== "update") {
    return `Existing content covers it (${action})`;
  }
  if ((gap.impressions ?? 0) < AUTOPILOT_SEARCH_GAP_MIN_IMPRESSIONS) {
    return `${gap.impressions ?? 0} impressions (minimum ${AUTOPILOT_SEARCH_GAP_MIN_IMPRESSIONS})`;
  }
  return null;
}
