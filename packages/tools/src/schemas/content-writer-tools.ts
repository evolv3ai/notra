import { contentTypeSchema } from "@notra/ai/schemas/content";
import { generatedPostMetadataShape } from "@notra/ai/schemas/post-metadata";
import { z } from "zod";

import { createPostBaseShape, postSlugSchema } from "./assistant-tools";

export const writerCreatePostInputSchema = z.object({
  ...generatedPostMetadataShape,
  title: createPostBaseShape.title,
  markdown: createPostBaseShape.markdown,
  slug: postSlugSchema
    .nullable()
    .optional()
    .default(null)
    .describe(
      "Optional URL slug for blog posts and changelogs. Use lowercase letters, numbers, and hyphens."
    ),
  recommendations: createPostBaseShape.recommendations,
  contentType: contentTypeSchema
    .optional()
    .describe(
      "The content type to create. Only used when the task configuration does not already pin a content type."
    ),
});
