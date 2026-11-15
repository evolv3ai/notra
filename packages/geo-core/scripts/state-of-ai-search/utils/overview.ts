import type { StateOfAiSearchOverview } from "../../../../../apps/web/src/types/state-of-ai-search";
import type { RawAnswer } from "../shared";

/** DOM captures keep sources at answer level, so cite them on the whole paragraph. */
export function reportOverviewFallback(
  answer: RawAnswer,
  text: string
): StateOfAiSearchOverview {
  return {
    query: answer.prompt,
    blocks: [
      {
        type: "paragraph",
        text,
        refs: answer.sources.map((_, index) => index),
      },
    ],
    references: answer.sources.map((source, index) => ({
      index,
      title: source.title ?? source.domain,
      url: source.url,
      source: source.domain,
    })),
  };
}
