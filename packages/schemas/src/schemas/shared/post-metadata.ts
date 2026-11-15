import { POST_AUTHORS_MAX } from "@notra/ai/constants/post-metadata";
import {
  postCoverImageSchema,
  postExcerptPatchSchema,
  postMediaUrlSchema,
  postTagsSchema,
} from "@notra/ai/schemas/post-metadata";
import { SITE_AUTHOR_ID } from "@notra/sites-core/constants/site-config";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import {
  CONTENT_AUTHOR_BIO_MAX_LENGTH,
  CONTENT_AUTHOR_LINK_MAX_LENGTH,
  CONTENT_AUTHOR_NAME_MAX_LENGTH,
  CONTENT_AUTHOR_TITLE_MAX_LENGTH,
} from "../../constants/dashboard/post-metadata";

export const postAuthorIdsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(POST_AUTHORS_MAX)
  .transform((ids) => [...new Set(ids)]);

/** YYYY-MM-DD; null falls back to the publish date. */
export const postDisplayDatePatchSchema = z.iso.date().nullable();

/** Every field optional: send only what changed. */
export const postMetadataPatchSchema = z
  .object({
    coverImage: postCoverImageSchema.nullable().optional(),
    tags: postTagsSchema.optional(),
    excerpt: postExcerptPatchSchema.optional(),
    authorIds: postAuthorIdsSchema.optional(),
    featured: z.boolean().optional(),
    noindex: z.boolean().optional(),
    hidden: z.boolean().optional(),
    displayDate: postDisplayDatePatchSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export type PostMetadataPatch = z.infer<typeof postMetadataPatchSchema>;

export const postMetadataSchema = z.object({
  coverImage: postCoverImageSchema.nullable(),
  tags: z.array(z.string()),
  excerpt: z.string().nullable(),
  authorIds: z.array(z.string()),
  featured: z.boolean(),
  noindex: z.boolean(),
  hidden: z.boolean(),
  displayDate: z.string().nullable(),
});

export type PostMetadata = z.infer<typeof postMetadataSchema>;

const optionalLinkSchema = z
  .string()
  .trim()
  .max(CONTENT_AUTHOR_LINK_MAX_LENGTH)
  .refine(
    (value) =>
      value === "" || z.url({ protocol: /^https?$/ }).safeParse(value).success,
    {
      error: "Use a full https link",
    }
  )
  .transform((value) => value || null)
  .nullable()
  .optional();

export const contentAuthorFieldsSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(SITE_AUTHOR_ID, "Use lowercase letters, digits and dashes"),
  name: z.string().trim().min(1).max(CONTENT_AUTHOR_NAME_MAX_LENGTH),
  title: z
    .string()
    .trim()
    .max(CONTENT_AUTHOR_TITLE_MAX_LENGTH)
    .transform((value) => value || null)
    .nullable()
    .optional(),
  bio: z
    .string()
    .trim()
    .max(CONTENT_AUTHOR_BIO_MAX_LENGTH)
    .transform((value) => value || null)
    .nullable()
    .optional(),
  avatarUrl: postMediaUrlSchema.nullable().optional(),
  url: optionalLinkSchema,
  x: optionalLinkSchema,
  linkedin: optionalLinkSchema,
  github: optionalLinkSchema,
});

const contentAuthorSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  url: z.string().nullable(),
  x: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  userId: z.string().nullable(),
});

export type ContentAuthor = z.infer<typeof contentAuthorSchema>;
