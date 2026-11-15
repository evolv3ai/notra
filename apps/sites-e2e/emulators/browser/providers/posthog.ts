import assert from "node:assert/strict";

import type { AnalyticsProvider } from "../types";
import { isPageUrl, jsonOf } from "../utils";

const settings = {
  apiKey: "phc_synthetic0000000000000000",
  sessionRecording: false,
};

export const posthog: AnalyticsProvider = {
  name: "posthog",
  settings,
  script: "https://us-assets.i.posthog.com/static/array.js",
  standIn: "posthog.js",
  endpoint: "https://us.i.posthog.com/i/v0/e/",
  // The bundle and its remote config come from the CDN; feature-flag
  // lookups are answered locally with no flags.
  isLiveAsset: (url) =>
    url.hostname === "us-assets.i.posthog.com" &&
    (/^\/static\/.+\.js$/.test(url.pathname) ||
      url.pathname === `/array/${settings.apiKey}/config.js` ||
      url.pathname === `/array/${settings.apiKey}/config`),
  answerLive: (url) =>
    url.hostname === "us.i.posthog.com" &&
    /^\/(?:flags|decide)\/?$/.test(url.pathname)
      ? {
          featureFlags: {},
          featureFlagPayloads: {},
          errorsWhileComputingFlags: false,
        }
      : undefined,
  isLiveCollect: (url) =>
    url.hostname === "us.i.posthog.com" &&
    /^\/(?:e|i\/v0\/e|batch)\/?$/.test(url.pathname),
  identifier: settings.apiKey,
  isLivePageView: (event, page) => {
    const body = jsonOf(event.body) as { batch?: unknown[] } | unknown[] | null;
    const events = Array.isArray(body) ? body : (body?.batch ?? [body]);
    return (
      event.method === "POST" &&
      Array.isArray(events) &&
      events.some((entry) => {
        const item = entry as {
          event?: string;
          properties?: { token?: string; $current_url?: string };
        } | null;
        return (
          item?.event === "$pageview" &&
          item.properties?.token === settings.apiKey &&
          isPageUrl(item.properties.$current_url, page)
        );
      })
    );
  },
  assertEmulated(event, pageUrl) {
    const body = JSON.parse(event.body ?? "null");
    const url = new URL(pageUrl);
    assert.equal(body.api_key, settings.apiKey);
    assert.equal(body.event, "$pageview");
    assert.deepEqual(body.properties, {
      $current_url: pageUrl,
      $host: url.host,
      $pathname: url.pathname,
    });
    assert.deepEqual(body.fixture_options, {
      api_host: "https://us.i.posthog.com",
      disable_session_recording: true,
      cross_subdomain_cookie: false,
    });
  },
};
