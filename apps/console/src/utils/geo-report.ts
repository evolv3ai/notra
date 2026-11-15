import {
  GEO_DEFAULT_SECTION_STATE,
  GEO_SECTION_ORDER,
  SHARE_ROUTE_PREFIX,
} from "@/constants/geo-report";
import type {
  GeoReportSectionState,
  GeoTrackedPrompt,
} from "@/types/geo-report";

export function formatPercent(fraction: number) {
  return `${Math.round(fraction * 100)}%`;
}

const reportDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatReportDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }
  return reportDateFormatter.format(date);
}

export function countMentions(prompt: GeoTrackedPrompt, modelIds: string[]) {
  let count = 0;
  for (const modelId of modelIds) {
    if (prompt.ranks[modelId] != null) {
      count += 1;
    }
  }
  return count;
}

const SHARE_HIDE_PARAM = "hide";

/** Builds the public share path, encoding hidden sections and any extra params. */
export function buildGeoSharePath(
  reportId: string,
  sections: GeoReportSectionState,
  extra: Record<string, string> = {}
) {
  const params = new URLSearchParams(extra);
  const hidden = GEO_SECTION_ORDER.filter((id) => !sections[id]);
  if (hidden.length > 0) {
    params.set(SHARE_HIDE_PARAM, hidden.join(","));
  }
  const query = params.toString();
  return `${SHARE_ROUTE_PREFIX}${reportId}${query ? `?${query}` : ""}`;
}

/** Reads hidden sections back out of a share URL's search params. */
export function parseGeoShareSections(
  searchParams: Record<string, string | string[] | undefined>
): GeoReportSectionState {
  const hideRaw = searchParams[SHARE_HIDE_PARAM];
  const hidden = new Set(
    (Array.isArray(hideRaw) ? hideRaw : [hideRaw ?? ""])
      .flatMap((value) => value.split(","))
      .filter(Boolean)
  );
  const sections = { ...GEO_DEFAULT_SECTION_STATE };
  for (const id of GEO_SECTION_ORDER) {
    sections[id] = !hidden.has(id);
  }
  return sections;
}
