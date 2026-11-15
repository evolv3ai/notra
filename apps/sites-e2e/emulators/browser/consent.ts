import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Route } from "playwright";

import type { CollectedEvent } from "./types";

// The c15t backend a consent-banner site saves choices to. `/init` answers
// the EU opt-in policy (c15t's own offline resolution for Germany, frozen in
// fixtures/c15t-init.json); every other call is recorded and acknowledged.
export const CONSENT_BACKEND_URL = "https://consent.sites-e2e.example";

export function consentIntegrations() {
  return { c15t: { backendURL: CONSENT_BACKEND_URL } };
}

export async function answerConsentBackend(
  route: Route,
  root: string,
  requests: CollectedEvent[]
) {
  const request = route.request();
  const url = new URL(request.url());
  const headers = {
    "Access-Control-Allow-Origin": request.headers().origin ?? "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      request.headers()["access-control-request-headers"] ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, OPTIONS",
  };
  if (request.method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers });
    return;
  }
  requests.push({
    provider: "c15t",
    url: request.url(),
    method: request.method(),
    body: request.postData(),
    at: performance.now(),
  });
  await route.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body:
      request.method() === "GET" && url.pathname === "/init"
        ? await readFile(
            join(root, "apps/sites-e2e/fixtures/c15t-init.json"),
            "utf8"
          )
        : "{}",
  });
}
