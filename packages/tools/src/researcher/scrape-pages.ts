import { Effect } from "effect";
import { defineTool } from "eve/tools";

import {
  SCRAPE_BATCH_MIN_PAGE_LENGTH,
  SCRAPE_BATCH_TIMEOUT_MS,
  SCRAPE_MARKDOWN_MAX_LENGTH,
} from "../constants/context-dev";
import { webpagesInputSchema } from "../schemas/research-tools";
import type { ScrapePageResult } from "../types/scrape";
import { scrapePageEffect } from "../utils/scrape";

export function createScrapePagesTool() {
  return defineTool({
    description:
      "Scrape up to 50 known owned-blog or newsroom URLs via context.dev in one bounded-concurrency call. Use after crawl_sitemap to collect reference candidates efficiently.",
    inputSchema: webpagesInputSchema,
    async execute({ urls }, ctx) {
      // Exact matches only: query ordering and signed URLs remain untouched.
      const uniqueUrls = [...new Set(urls)];
      const results = new Map<string, ScrapePageResult>();
      const perPageMarkdownLimit = Math.max(
        SCRAPE_BATCH_MIN_PAGE_LENGTH,
        Math.floor(SCRAPE_MARKDOWN_MAX_LENGTH / uniqueUrls.length)
      );
      await Effect.runPromise(
        Effect.all(
          uniqueUrls.map((url) =>
            scrapePageEffect(url, ctx, perPageMarkdownLimit).pipe(
              Effect.catch((error) =>
                Effect.succeed({
                  error: error.message,
                  markdown: null,
                  title: null,
                  url,
                })
              ),
              Effect.tap((result) =>
                Effect.sync(() => results.set(url, result))
              )
            )
          ),
          { concurrency: 5 }
        ).pipe(Effect.timeoutOption(SCRAPE_BATCH_TIMEOUT_MS))
      );
      return uniqueUrls.map(
        (url) =>
          results.get(url) ?? {
            url,
            error: "Scrape batch deadline exceeded",
            markdown: null,
            title: null,
          }
      );
    },
  });
}
