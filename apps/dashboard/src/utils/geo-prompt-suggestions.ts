import type { GeoSuggestionKeyword } from "@notra/geo-core/types/geo";
import { isQuestionQuery } from "@notra/geo-core/utils/gsc-question";

import type { SuggestionKeywordTotals } from "@/types/components/geo";

export function suggestionKeywordTotals(
  keywords: readonly GeoSuggestionKeyword[]
): SuggestionKeywordTotals {
  let impressions = 0;
  let clicks = 0;
  let position: number | null = null;
  for (const keyword of keywords) {
    impressions += keyword.impressions;
    clicks += keyword.clicks;
    if (position === null || keyword.position < position) {
      position = keyword.position;
    }
  }
  return {
    impressions,
    clicks,
    position,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
  };
}

/** The most-seen question behind a suggestion, in the searcher's own words. */
export function suggestionQuestion(
  keywords: readonly GeoSuggestionKeyword[]
): GeoSuggestionKeyword | null {
  let best: GeoSuggestionKeyword | null = null;
  for (const keyword of keywords) {
    if (
      isQuestionQuery(keyword.query) &&
      (best === null || keyword.impressions > best.impressions)
    ) {
      best = keyword;
    }
  }
  return best;
}
