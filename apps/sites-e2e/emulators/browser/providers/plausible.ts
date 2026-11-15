import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { isPageUrl, jsonOf } from "../utils";

const settings = { domain: "acme.example.com" };

export const plausible: AnalyticsProvider = {
  name: "plausible",
  settings,
  script: "https://plausible.io/js/script.js",
  standIn: "plausible.js",
  endpoint: "https://plausible.io/api/event",
  isLiveAsset: (url) =>
    url.hostname === "plausible.io" && /^\/js\/[^/]+\.js$/.test(url.pathname),
  isLiveCollect: (url) =>
    url.hostname === "plausible.io" && url.pathname === "/api/event",
  identifier: settings.domain,
  isLivePageView: (event, page) => {
    const body = jsonOf(event.body) as {
      n?: string;
      d?: string;
      u?: string;
    } | null;
    return (
      event.method === "POST" &&
      body?.n === "pageview" &&
      body.d === settings.domain &&
      isPageUrl(body.u, page)
    );
  },
  assertEmulated(event, pageUrl) {
    assert.deepEqual(JSON.parse(event.body ?? "null"), {
      name: "pageview",
      domain: settings.domain,
      url: pageUrl,
    });
  },
};
