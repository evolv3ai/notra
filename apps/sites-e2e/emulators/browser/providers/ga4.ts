import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { isPageUrl } from "../utils";

const settings = { measurementId: "G-E2E00000" };

export const ga4: AnalyticsProvider = {
  name: "ga4",
  settings,
  script: `https://www.googletagmanager.com/gtag/js?id=${settings.measurementId}`,
  standIn: "ga4.js",
  endpoint: "https://www.google-analytics.com/g/collect",
  isLiveAsset: (url) =>
    url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js",
  // gtag also reports to www.google.com/g/collect (Google signals), seen
  // from EU runners, and sends tag diagnostics to googletagmanager.com/td
  // and /a.
  isLiveCollect: (url) =>
    ((url.hostname.endsWith("google-analytics.com") ||
      url.hostname === "www.google.com") &&
      url.pathname.endsWith("/g/collect")) ||
    (url.hostname === "www.googletagmanager.com" &&
      ["/td", "/a"].includes(url.pathname)),
  identifier: settings.measurementId,
  isLivePageView: (event, page) => {
    const query = new URL(event.url).searchParams;
    return (
      query.get("en") === "page_view" &&
      query.get("tid") === settings.measurementId &&
      isPageUrl(query.get("dl"), page)
    );
  },
  assertEmulated(event, pageUrl) {
    const query = new URL(event.url).searchParams;
    assert.equal(query.get("v"), "2");
    assert.equal(query.get("tid"), settings.measurementId);
    assert.equal(query.get("fixture_script_id"), settings.measurementId);
    assert.equal(query.get("fixture_cookie_domain"), "none");
    assert.equal(query.get("en"), "page_view");
    assert.equal(query.get("dl"), pageUrl);
    assert.ok(query.get("dt"));
  },
};
