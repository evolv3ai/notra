import type { GeoTrafficSourceBand } from "@/types/geo";

export const TRAFFIC_SOURCE_BANDS = [
  "crawler",
  "cited",
  "ai_referral",
] as const satisfies readonly GeoTrafficSourceBand[];

export const TRAFFIC_SOURCE_COLLAPSED_BORDER_PX = 2;

export const TRAFFIC_SOURCE_COLUMN_MIN_WIDTH = {
  source: "16rem",
  botSource: "11rem",
  category: "11rem",
  categoryMobile: "11rem",
  visits: "10.5rem",
  visitsMobile: "7.5rem",
  paths: "6rem",
  lastSeenAt: "9rem",
} as const;

export const TRAFFIC_SOURCE_BAND_LABEL_KEYS = {
  crawler: "crawlers",
  cited: "cited",
  ai_referral: "referrals",
} as const satisfies Record<GeoTrafficSourceBand, string>;
