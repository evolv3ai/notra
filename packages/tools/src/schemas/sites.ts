import { Data } from "effect";
import { z } from "zod";

export class SiteContentReadError extends Data.TaggedError(
  "SiteContentReadError"
) {}

export const getSitesInputSchema = z.strictObject({
  projectId: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(25),
  offset: z.number().int().min(0).default(0),
});

export const getSiteContentInputSchema = z.strictObject({
  siteId: z.string().trim().min(1),
  area: z.enum(["blog", "changelog"]).optional(),
  path: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .optional()
    .describe(
      "An absolute public page or Markdown path from this site's index, such as /blog/launch.md. Omit to read the area's published-content index. Never pass a URL or a repository path."
    ),
});
