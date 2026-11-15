import {
  POST_MARKDOWN_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
} from "@notra/ai/schemas/limits";
import { BLOG_POST_SUBTYPES } from "@notra/db/constants/content";
import {
  POST_HISTORY_CONTENT_TYPES,
  POST_HISTORY_SOURCES,
} from "@notra/db/constants/post-history";
import { z } from "zod";

import {
  CONTENT_HISTORY_CHANGES,
  CONTENT_HISTORY_MAX_PAGE_SIZE,
  CONTENT_HISTORY_PAGE_SIZE,
  CONTENT_REVISION_MAX,
} from "../../constants/dashboard/content-history";
import { postSlugSchema } from "../shared/post";
import { postMetadataSchema } from "../shared/post-metadata";
import { contentInputSchema } from "./content";

export const contentRevisionSchema = z
  .number()
  .int()
  .min(0)
  .max(CONTENT_REVISION_MAX);

export const saveContentDocumentSchema = contentInputSchema
  .extend({
    expectedRevision: contentRevisionSchema,
    title: z.string().trim().min(1).max(POST_TITLE_MAX_LENGTH).optional(),
    slug: postSlugSchema.nullable().optional(),
    markdown: z.string().max(POST_MARKDOWN_MAX_LENGTH).optional(),
    autosave: z.boolean().optional().default(false),
  })
  .refine(
    (input) =>
      input.title !== undefined ||
      input.slug !== undefined ||
      input.markdown !== undefined,
    { message: "At least one document field must be provided" }
  );

export const contentHistoryListInputSchema = contentInputSchema.extend({
  cursor: contentRevisionSchema.optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(CONTENT_HISTORY_MAX_PAGE_SIZE)
    .optional()
    .default(CONTENT_HISTORY_PAGE_SIZE),
});

export const contentHistoryVersionInputSchema = contentInputSchema.extend({
  versionId: z.uuid(),
});

export const contentHistoryCheckpointInputSchema = contentInputSchema.extend({
  expectedRevision: contentRevisionSchema,
  manual: z.boolean().optional().default(false),
});

export const contentHistoryRestoreInputSchema =
  contentHistoryVersionInputSchema.extend({
    expectedRevision: contentRevisionSchema,
  });

export const contentHistoryMetadataSchema = postMetadataSchema
  .omit({ hidden: true })
  .extend({
    contentType: z.enum(POST_HISTORY_CONTENT_TYPES),
    contentSubtype: z.enum(BLOG_POST_SUBTYPES).nullable(),
    recommendations: z.string().nullable(),
  });

export const contentHistoryActorSchema = z
  .object({ id: z.string(), name: z.string() })
  .nullable();

export const contentHistoryEntrySchema = z.object({
  id: z.string(),
  revision: contentRevisionSchema,
  title: z.string(),
  createdAt: z.string(),
  source: z.enum(POST_HISTORY_SOURCES),
  retained: z.boolean().optional(),
  actor: contentHistoryActorSchema,
  changes: z.array(z.enum(CONTENT_HISTORY_CHANGES)).optional(),
  /** Position in the saved history, oldest = 1. */
  number: z.number().int().positive().optional(),
});

export const contentHistoryVersionSchema = contentHistoryEntrySchema.extend({
  slug: z.string().nullable(),
  markdown: z.string().nullable(),
  metadata: contentHistoryMetadataSchema,
});
