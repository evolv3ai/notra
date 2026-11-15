import type { IpCheckerSearch } from "@/types/ip-checker";
import type { OfferingReportSearch } from "@/types/offering-check";

function parseSearchText(value: unknown): string | undefined {
  return value === undefined || typeof value === "string"
    ? value
    : JSON.stringify(value);
}

export function parseIpCheckerSearch(
  search: Record<string, unknown>
): IpCheckerSearch {
  const { ip } = search;
  return {
    ip:
      typeof ip === "string" || typeof ip === "number" ? String(ip) : undefined,
  };
}

export function parseOfferingReportSearch(
  search: Record<string, unknown>
): OfferingReportSearch {
  return {
    domain: parseSearchText(search.domain),
    feature: parseSearchText(search.feature),
    problem: parseSearchText(search.problem),
    webSearch:
      typeof search.webSearch === "boolean" ? search.webSearch : undefined,
  };
}
