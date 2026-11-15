import type { useTranslations } from "use-intl";
export type GeoMentionTrendEmptyState = "trend.noVisibility" | "notScanned";

export type GeoSharedTranslator = ReturnType<
  typeof useTranslations<"geo.shared">
>;
