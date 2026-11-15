import { FEATURES } from "@notra/ai/billing/features";

import { USAGE_METERED_FEATURES } from "@/constants/billing";
import type {
  BalanceRecord,
  FeatureData,
  UsageAggregateRow,
  UsageBreakdownPoint,
} from "@/types/hooks/billing";
import { formatDollars } from "@/utils/format";

function formatFeatureName(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isLogRetentionFeature(featureId: string) {
  return (
    featureId === FEATURES.LOG_RETENTION_7_DAYS ||
    featureId === FEATURES.LOG_RETENTION_14_DAYS ||
    featureId === FEATURES.LOG_RETENTION_30_DAYS
  );
}

export function isRetentionFeature(feature: FeatureData) {
  return isLogRetentionFeature(feature.id);
}

export function featuresFromBalances(
  balances: Record<string, BalanceRecord | null> | null | undefined
): FeatureData[] {
  if (!balances) {
    return [];
  }
  const features: FeatureData[] = [];
  for (const [id, feature] of Object.entries(balances)) {
    features.push({
      id,
      name: formatFeatureName(id),
      balance:
        typeof feature?.remaining === "number" ? feature.remaining : null,
      included: typeof feature?.granted === "number" ? feature.granted : null,
      unlimited: feature?.unlimited === true,
      nextResetAt:
        typeof feature?.nextResetAt === "number" ? feature.nextResetAt : null,
    });
  }
  return features;
}

export function meteredUsageFeatures(features: readonly FeatureData[]) {
  return USAGE_METERED_FEATURES.flatMap((id) => {
    const feature = features.find((candidate) => candidate.id === id);
    return feature && !feature.unlimited && feature.included !== null
      ? [feature]
      : [];
  });
}

export function usageBreakdownPoints(
  rows: readonly UsageAggregateRow[] | null | undefined
): UsageBreakdownPoint[] {
  if (!rows?.length) {
    return [];
  }
  return rows.map((row) => {
    const value = row.values?.[FEATURES.AI_ANSWERS];
    return {
      date: row.period,
      ai_answers: typeof value === "number" ? value : 0,
    };
  });
}

export function creditsValue(feature: FeatureData, locale: string) {
  return feature.balance !== null
    ? formatDollars(feature.balance, locale)
    : "-";
}
