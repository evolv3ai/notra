import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { isPageUrl, jsonOf } from "../utils";

const settings = {
  clientId: "e2e_databuddy_client",
  trackWebVitals: true,
  trackOutgoingLinks: true,
  skipPatterns: ["/drafts/**"],
};

export const databuddy: AnalyticsProvider = {
  name: "databuddy",
  settings,
  script: "https://cdn.databuddy.cc/databuddy.js",
  standIn: "databuddy.js",
  endpoint: "https://basket.databuddy.cc/",
  isLiveAsset: (url) =>
    url.hostname === "cdn.databuddy.cc" && url.pathname === "/databuddy.js",
  isLiveCollect: (url) => url.hostname === "basket.databuddy.cc",
  identifier: settings.clientId,
  // Page views go to /batch as `screen_view`; /vitals and /engagement carry
  // the same client ID but are not page views.
  isLivePageView: (event, page) => {
    const batch = jsonOf(event.body);
    const url = new URL(event.url);
    return (
      event.method === "POST" &&
      url.pathname === "/batch" &&
      url.searchParams.get("client_id") === settings.clientId &&
      Array.isArray(batch) &&
      batch.some(
        (item) => item?.name === "screen_view" && isPageUrl(item.path, page)
      )
    );
  },
  assertEmulated(event, pageUrl) {
    assert.equal(
      new URL(event.url).searchParams.get("client_id"),
      settings.clientId
    );
    const { title, ...rest } = JSON.parse(event.body ?? "null");
    assert.ok(title);
    assert.deepEqual(rest, {
      type: "track",
      name: "screen_view",
      path: pageUrl,
      options: {
        trackWebVitals: "true",
        trackOutgoingLinks: "true",
        skipPatterns: JSON.stringify(settings.skipPatterns),
      },
    });
  },
};
