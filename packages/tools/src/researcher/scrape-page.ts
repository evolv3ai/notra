import { Effect } from "effect";
import { defineTool } from "eve/tools";

import { SCRAPE_MARKDOWN_MAX_LENGTH } from "../constants/context-dev";
import { webpageInputSchema } from "../schemas/research-tools";
import { scrapePageEffect } from "../utils/scrape";

export function createScrapePageTool() {
  return defineTool({
    description:
      "Scrape a web page into clean markdown via context.dev. Use for company websites, blog posts, changelogs, and LinkedIn company pages.",
    inputSchema: webpageInputSchema,
    async execute({ url }, ctx) {
      return Effect.runPromise(
        scrapePageEffect(url, ctx, SCRAPE_MARKDOWN_MAX_LENGTH)
      );
    },
  });
}
