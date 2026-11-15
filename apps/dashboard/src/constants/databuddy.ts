export const DATABUDDY_DASHBOARD_WEBSITE_ID =
  process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID;

export const DATABUDDY_TRACKING_PARAMS = [
  "anonId",
  "sessionId",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "ttclid",
  "twclid",
  "li_fat_id",
  "msclkid",
] as const;

export const DATABUDDY_FUNNEL_EVENT_NAMES = {
  FIRST_SCAN_STARTED: "first_scan_started",
  FIRST_SCAN_COMPLETED: "first_scan_completed",
} as const;
