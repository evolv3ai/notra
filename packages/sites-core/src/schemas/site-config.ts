import {
  SITE_APPEARANCE_STORAGE_KEY,
  SITE_AUTHOR_AVATAR,
  SITE_AUTHOR_ID,
  SITE_DEFAULT_APPEARANCE_STORAGE_KEY,
  SITE_DEFAULT_PRIMARY_COLOR,
  SITE_HEX_COLOR,
  SITE_LINK_HREF,
} from "@notra/sites-core/constants/site-config";
import {
  siteIntegrationsSchema,
  siteSecuritySchema,
} from "@notra/sites-core/schemas/site-integrations";
import {
  siteBannerSchema,
  siteBlogSchema,
  siteChangelogSchema,
  siteContextualSchema,
  siteErrorsSchema,
  siteFooterSchema,
  siteLayoutSchema,
  siteMarkdownSchema,
  siteMetadataSchema,
  siteNavbarSchema,
  sitePathSchema,
  siteSeoSchema,
  siteThumbnailsSchema,
  siteVariablesSchema,
} from "@notra/sites-core/schemas/site-layout";
import { z } from "zod";

const redirectSchema = z.object({
  source: z.string().trim().startsWith("/"),
  destination: z
    .string()
    .trim()
    .regex(SITE_LINK_HREF, "Use an absolute https:// URL or a path"),
  permanent: z.boolean().default(true),
});

const siteAuthorSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  title: z.string().trim().max(80).optional(),
  avatar: z
    .string()
    .trim()
    .regex(
      SITE_AUTHOR_AVATAR,
      "Use a path like /images/jan.jpg or an https:// URL"
    )
    .optional(),
  bio: z.string().trim().max(300).optional(),
  url: z.url().optional(),
  x: z.url().optional(),
  linkedin: z.url().optional(),
  github: z.url().optional(),
  youtube: z.url().optional(),
});
const imageByModeSchema = z.object({
  light: sitePathSchema,
  dark: sitePathSchema,
});

const fontSpecSchema = z.object({
  family: z.string().trim().min(1).max(80),
  weight: z.number().int().min(100).max(900).optional(),
  source: z.string().trim().min(1).optional(),
  format: z.enum(["woff", "woff2"]).optional(),
});

const appearanceSchema = z
  .union([
    z.enum(["light", "dark", "system"]),
    z.object({
      default: z.enum(["light", "dark", "system"]).default("system"),
      strict: z.boolean().default(false),
      storageKey: z
        .string()
        .trim()
        .regex(
          SITE_APPEARANCE_STORAGE_KEY,
          "Use letters, digits, dashes, underscores or dots"
        )
        .default(SITE_DEFAULT_APPEARANCE_STORAGE_KEY),
    }),
  ])
  .default("system")
  .transform((value) =>
    typeof value === "string"
      ? {
          default: value,
          strict: false,
          storageKey: SITE_DEFAULT_APPEARANCE_STORAGE_KEY,
        }
      : value
  );

const shikiThemeName = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/);

export const siteConfigSchema = z.object({
  $schema: z.string().optional(),
  theme: z.enum(["notra"]).default("notra"),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  logo: z
    .union([
      sitePathSchema,
      imageByModeSchema.extend({
        href: z.string().trim().regex(SITE_LINK_HREF).optional(),
      }),
    ])
    .optional(),
  favicon: z.union([sitePathSchema, imageByModeSchema]).optional(),
  colors: z
    .object({
      primary: z
        .string()
        .regex(SITE_HEX_COLOR)
        .default(SITE_DEFAULT_PRIMARY_COLOR),
      light: z.string().regex(SITE_HEX_COLOR).optional(),
      dark: z.string().regex(SITE_HEX_COLOR).optional(),
    })
    .default({ primary: SITE_DEFAULT_PRIMARY_COLOR }),
  appearance: appearanceSchema,
  fonts: fontSpecSchema
    .partial({ family: true })
    .extend({
      heading: fontSpecSchema.optional(),
      body: fontSpecSchema.optional(),
    })
    .optional(),
  background: z
    .object({
      decoration: z.enum(["none", "grid", "dots", "gradient"]).default("none"),
      image: z.union([sitePathSchema, imageByModeSchema]).optional(),
      color: z
        .object({
          light: z.string().regex(SITE_HEX_COLOR).optional(),
          dark: z.string().regex(SITE_HEX_COLOR).optional(),
        })
        .optional(),
    })
    .default({ decoration: "none" }),
  styling: z
    .object({
      codeblocks: z
        .union([
          z.enum(["system", "dark"]),
          shikiThemeName,
          z.object({ light: shikiThemeName, dark: shikiThemeName }),
        ])
        .default("system"),
      smartQuotes: z
        .boolean()
        .default(true)
        .describe(
          "Turn straight quotes, apostrophes, dashes and ellipses into typographic ones. Set false to keep the characters exactly as written."
        ),
    })
    .default({ codeblocks: "system", smartQuotes: true }),
  layout: siteLayoutSchema,
  banner: siteBannerSchema.optional(),
  navbar: siteNavbarSchema,
  footer: siteFooterSchema,
  authors: z
    .record(
      z
        .string()
        .regex(
          SITE_AUTHOR_ID,
          "Use lowercase letters, digits and dashes for author ids"
        ),
      siteAuthorSchema
    )
    .default({}),
  blog: siteBlogSchema.optional(),
  changelog: siteChangelogSchema.optional(),
  contextual: siteContextualSchema,
  seo: siteSeoSchema,
  errors: siteErrorsSchema,
  thumbnails: siteThumbnailsSchema,
  metadata: siteMetadataSchema,
  markdown: siteMarkdownSchema,
  variables: siteVariablesSchema,
  redirects: z.array(redirectSchema).max(500).default([]),
  integrations: siteIntegrationsSchema,
  security: siteSecuritySchema,
});

const frontmatterLinkSchema = z.url({
  protocol: /^https?$/,
  error: "Use a full http(s):// URL",
});

/** An author written inline in a post. An `id` from `authors` lets blog.json fill or override the fields. */
export const frontmatterAuthorSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(
      SITE_AUTHOR_ID,
      "Use lowercase letters, digits and dashes for author ids"
    )
    .optional(),
  name: z.string().trim().min(1),
  title: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  avatar: z
    .string()
    .trim()
    .regex(
      SITE_AUTHOR_AVATAR,
      "Use a path like /images/jan.jpg or an https:// URL"
    )
    .optional(),
  url: frontmatterLinkSchema.optional(),
  x: frontmatterLinkSchema.optional(),
  linkedin: frontmatterLinkSchema.optional(),
  github: frontmatterLinkSchema.optional(),
  youtube: frontmatterLinkSchema.optional(),
});

const frontmatterDate = z.coerce.date({
  error: "Use a date in YYYY-MM-DD format, like 2026-11-01",
});

const frontmatterAuthorRefSchema = z.union([
  z.string(),
  frontmatterAuthorSchema,
]);

export const blogFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  date: frontmatterDate,
  updated: frontmatterDate.optional(),
  author: z
    .union([frontmatterAuthorRefSchema, z.array(frontmatterAuthorRefSchema)])
    .optional(),
  image: z.string().optional(),
  imageAlt: z.string().trim().optional(),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  hidden: z.boolean().default(false),
  noindex: z.boolean().default(false),
});

export const changelogFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  date: frontmatterDate,
  version: z.string().trim().optional(),
  tags: z.array(z.string()).default([]),
  image: z.string().optional(),
  imageAlt: z.string().trim().optional(),
  draft: z.boolean().default(false),
  hidden: z.boolean().default(false),
});
