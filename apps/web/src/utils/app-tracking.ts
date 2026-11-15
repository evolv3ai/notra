import { getTrackingParams } from "@databuddy/sdk";

import {
  APP_TRACKING_FORWARDED_PARAMS,
  DATABUDDY_STORED_PARAMS_KEY,
} from "@/constants/app-tracking";
import { APP_URL } from "@/utils/urls";

const APP_ORIGIN = new URL(APP_URL).origin;

function readStoredParams(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(DATABUDDY_STORED_PARAMS_KEY) ?? "{}"
    );
    return parsed && typeof parsed === "object" ? { ...parsed } : {};
  } catch {
    return {};
  }
}

export function withAppTracking(href: string): string {
  if (typeof window === "undefined") {
    return href;
  }
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return href;
  }
  if (url.origin !== APP_ORIGIN) {
    return href;
  }
  const params = new URLSearchParams(getTrackingParams());
  const current = new URLSearchParams(window.location.search);
  const stored = readStoredParams();
  for (const key of APP_TRACKING_FORWARDED_PARAMS) {
    const value = current.get(key) ?? stored[key];
    if (typeof value === "string" && value) {
      params.set(key, value);
    }
  }
  for (const [key, value] of params) {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
