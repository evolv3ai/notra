import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { isPageUrl, jsonOf } from "../utils";

const settings = { websiteId: "00000000-0000-4000-8000-000000000001" };

export const umami: AnalyticsProvider = {
  name: "umami",
  settings,
  script: "https://cloud.umami.is/script.js",
  standIn: "umami.js",
  endpoint: "https://gateway.umami.is/api/send",
  isLiveAsset: (url) =>
    url.hostname === "cloud.umami.is" && url.pathname === "/script.js",
  isLiveCollect: (url) =>
    url.hostname.endsWith("umami.is") && url.pathname === "/api/send",
  identifier: settings.websiteId,
  // A page view is an `event` without a custom event name.
  isLivePageView: (event, page) => {
    const body = jsonOf(event.body) as {
      type?: string;
      payload?: { name?: string; website?: string; url?: string };
    } | null;
    return (
      event.method === "POST" &&
      body?.type === "event" &&
      !body.payload?.name &&
      body.payload?.website === settings.websiteId &&
      isPageUrl(body.payload.url, page)
    );
  },
  assertEmulated(event, pageUrl) {
    const body = JSON.parse(event.body ?? "null");
    const url = new URL(pageUrl);
    assert.equal(body.type, "event");
    assert.equal(body.payload.website, settings.websiteId);
    assert.equal(body.payload.hostname, url.hostname);
    assert.equal(body.payload.url, url.pathname);
    assert.ok(body.payload.title);
    assert.equal(body.payload.language, "en-US");
  },
};
