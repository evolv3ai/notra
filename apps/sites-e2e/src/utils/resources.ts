import assert from "node:assert/strict";

import { SITE_ANALYTICS_EVENT_FILE } from "@notra/sites-core/constants/sites";
import type { Page, Request } from "playwright";

export function createSiteResourceWaiter(
  page: Page,
  isSiteSubresource: (request: Request) => boolean
) {
  const pending = new Set<Request>();
  let updated = performance.now();
  page.on("request", (request) => {
    if (
      isSiteSubresource(request) &&
      !new URL(request.url()).pathname.endsWith(`/${SITE_ANALYTICS_EVENT_FILE}`)
    ) {
      pending.add(request);
      updated = performance.now();
    }
  });
  const finished = (request: Request) => {
    if (pending.delete(request)) {
      updated = performance.now();
    }
  };
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  return async () => {
    updated = performance.now();
    const deadline = performance.now() + 10_000;
    while (pending.size > 0 || performance.now() - updated < 500) {
      assert.ok(
        performance.now() < deadline,
        `Site resources did not settle: ${[...pending].map((request) => request.url()).join(", ")}`
      );
      await page.waitForTimeout(25);
    }
  };
}
