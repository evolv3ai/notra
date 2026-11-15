import { fetchWebpage } from "@notra/ai/utils/context-dev";
import { Effect } from "effect";
import type { SessionContext } from "eve/context";

import { SCRAPE_PAGE_TIMEOUT_MS } from "../constants/context-dev";
import { saveReferenceSnapshot } from "./reference-snapshot";
import { isTransientError, withTransientRetryEffect } from "./retry";

const TARGET_TIMEOUT_STATUS = 408;

/** A 408 from context.dev means the target site timed out, so retrying only waits again. */
export function isRetryableScrapeError(error: unknown): boolean {
  if (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      ("status" in error && error.status === TARGET_TIMEOUT_STATUS))
  ) {
    return false;
  }
  return isTransientError(error);
}

/** Include retries and snapshot persistence in the page's total budget. */
export function scrapePageEffect(
  url: string,
  ctx: SessionContext,
  markdownLimit: number
) {
  return withTransientRetryEffect(
    async (signal) => {
      signal.throwIfAborted();
      const page = await fetchWebpage(
        { timeoutMS: SCRAPE_PAGE_TIMEOUT_MS, url },
        { signal }
      );
      signal.throwIfAborted();
      const snapshot = await saveReferenceSnapshot({
        ctx,
        markdown: page.markdown,
        signal,
      });
      signal.throwIfAborted();
      return {
        markdown: page.markdown.slice(0, markdownLimit),
        title: page.metadata?.title ?? null,
        url: page.url,
        ...(snapshot ?? {}),
      };
    },
    {
      operationName: `Context.dev page scrape for ${url}`,
      shouldRetry: isRetryableScrapeError,
    }
  ).pipe(Effect.timeout(SCRAPE_PAGE_TIMEOUT_MS));
}
