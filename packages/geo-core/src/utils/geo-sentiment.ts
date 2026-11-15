import type { GeoSentimentCounts } from "@notra/db/types/geo-sentiment";

import type { GeoSentimentBucket } from "../types/geo-sentiment";

export function sentimentScore(
  counts: Pick<GeoSentimentCounts, "positive" | "neutral" | "negative">
): number | null {
  const classified = counts.positive + counts.neutral + counts.negative;
  return classified > 0
    ? (counts.positive * 100 + counts.neutral * 50) / classified
    : null;
}

export function exactSentimentExcerpt(
  answer: string,
  excerpt: string
): string | null {
  if (!excerpt.trim()) {
    return null;
  }
  const index = answer.indexOf(excerpt);
  return index < 0 ? null : answer.slice(index, index + excerpt.length);
}

export function summarizeSentiment(
  rows: GeoSentimentCounts[]
): GeoSentimentBucket {
  const counts = rows.reduce<GeoSentimentCounts>(
    (sum, row) => ({
      totalChecks: sum.totalChecks + row.totalChecks,
      mentions: sum.mentions + row.mentions,
      positive: sum.positive + row.positive,
      neutral: sum.neutral + row.neutral,
      negative: sum.negative + row.negative,
      lastCheckedAt:
        row.lastCheckedAt &&
        (!sum.lastCheckedAt || row.lastCheckedAt > sum.lastCheckedAt)
          ? row.lastCheckedAt
          : sum.lastCheckedAt,
    }),
    {
      totalChecks: 0,
      mentions: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      lastCheckedAt: null,
    }
  );
  const classifiedMentions = counts.positive + counts.neutral + counts.negative;
  return {
    ...counts,
    score: sentimentScore(counts),
    classifiedMentions,
    unknownMentions: counts.mentions - classifiedMentions,
    notMentioned: counts.totalChecks - counts.mentions,
    positiveShare: classifiedMentions
      ? counts.positive / classifiedMentions
      : null,
    neutralShare: classifiedMentions
      ? counts.neutral / classifiedMentions
      : null,
    negativeShare: classifiedMentions
      ? counts.negative / classifiedMentions
      : null,
    classificationCoverage: counts.mentions
      ? classifiedMentions / counts.mentions
      : null,
  };
}
