import {
  SITE_HEX_COLOR,
  SITE_ICON_NAME,
  SITE_LINK_HREF,
  SITE_META_TAG_NAME,
} from "@notra/sites-core/constants/site-config";
import {
  SITE_CONTEXTUAL_OPTIONS,
  SITE_NAVBAR_LINK_TYPES,
  SITE_SOCIAL_PLATFORMS,
} from "@notra/sites-core/constants/site-layout";
import { SITE_BLOG_CATEGORY_LIMIT } from "@notra/sites-core/constants/tags";
import { z } from "zod";

export const sitePathSchema = z.string().trim().min(1).max(300);

const href = z
  .string()
  .trim()
  .regex(SITE_LINK_HREF, "Use an absolute https:// URL or a path");
const icon = z
  .string()
  .trim()
  .regex(SITE_ICON_NAME, "Use a Lucide icon name like book-open");
const colorByMode = z.union([
  z.string().regex(SITE_HEX_COLOR),
  z.object({
    light: z.string().regex(SITE_HEX_COLOR),
    dark: z.string().regex(SITE_HEX_COLOR),
  }),
]);

const siteLinkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href,
  icon: icon.optional(),
});

const platformHref = z
  .url()
  .regex(/^https?:\/\//, "Use an http:// or https:// URL");

const siteNavbarLinkSchema = z.union([
  siteLinkSchema.strict(),
  z.strictObject({
    type: z.enum(SITE_NAVBAR_LINK_TYPES),
    href: platformHref,
    label: z.string().trim().min(1).max(60).optional(),
  }),
]);

const siteNavbarAreaSchema = z.strictObject({
  area: z.enum(["blog", "changelog"]),
  label: z.string().trim().min(1).max(60).regex(/\S/).optional(),
});
const blogNavbarAreaSchema = siteNavbarAreaSchema.extend({
  area: z.literal("blog"),
});
const changelogNavbarAreaSchema = siteNavbarAreaSchema.extend({
  area: z.literal("changelog"),
});

export const siteNavbarSchema = z
  .object({
    areas: z
      .union([
        z.tuple([]),
        z.tuple([siteNavbarAreaSchema]),
        z.tuple([blogNavbarAreaSchema, changelogNavbarAreaSchema]),
        z.tuple([changelogNavbarAreaSchema, blogNavbarAreaSchema]),
      ])
      .optional(),
    links: z
      .array(
        z.union([
          siteNavbarLinkSchema,
          z.strictObject({
            label: z.string().trim().min(1).max(60),
            icon: icon.optional(),
            items: z.array(siteNavbarLinkSchema).min(1).max(8),
          }),
        ])
      )
      .max(8)
      .default([]),
    cta: siteLinkSchema.optional(),
    primary: z
      .discriminatedUnion(
        "type",
        [
          z.object({
            type: z.enum(SITE_NAVBAR_LINK_TYPES),
            href: platformHref,
          }),
          siteLinkSchema.extend({ type: z.literal("button") }),
        ],
        {
          error: `Use one of ${SITE_NAVBAR_LINK_TYPES.join(", ")}. For a button with your own label, use navbar.cta`,
        }
      )
      .optional(),
  })
  .transform(({ primary, ...navbar }) => {
    if (primary?.type !== "button") {
      return primary ? { ...navbar, primary } : { ...navbar };
    }
    const { type: _type, ...button } = primary;
    return { ...navbar, cta: navbar.cta ?? button };
  })
  .default({ links: [] });

const footerColumnSchema = z.object({
  header: z.string().trim().min(1).max(60).optional(),
  items: z.array(siteLinkSchema).min(1).max(12),
});

export const siteFooterSchema = z
  .object({
    links: z
      .union([
        z.array(siteLinkSchema).max(16),
        z.array(footerColumnSchema).max(6),
      ])
      .default([]),
    socials: z
      .partialRecord(z.enum(SITE_SOCIAL_PLATFORMS), platformHref)
      .default({}),
  })
  .default({ links: [], socials: {} });

export const siteBannerSchema = z.object({
  content: z.string().trim().min(1).max(300),
  dismissible: z.boolean().default(false),
  type: z.enum(["info", "warning", "critical"]).default("info"),
  color: colorByMode.optional(),
});

export const siteContextualSchema = z
  .object({
    options: z
      .array(
        z.union([
          z.enum(SITE_CONTEXTUAL_OPTIONS),
          z.object({
            title: z.string().trim().min(1).max(60),
            description: z.string().trim().max(120).optional(),
            icon: icon.optional(),
            href: z
              .string()
              .trim()
              .max(500)
              .regex(
                /^(?:https?:\/\/|\/(?!\/)|mailto:)/,
                "Use an https:// URL or a path. Notra fills in {url} and {markdownUrl}."
              ),
          }),
        ])
      )
      .max(12)
      .default(["copy", "view", "chatgpt", "claude", "perplexity", "grok"]),
    display: z.enum(["meta", "none"]).default("meta"),
  })
  .default({
    options: ["copy", "view", "chatgpt", "claude", "perplexity", "grok"],
    display: "meta",
  });

export const siteSeoSchema = z
  .object({
    metatags: z
      .record(z.string().regex(SITE_META_TAG_NAME), z.string().max(500))
      .default({}),
    indexing: z.enum(["navigable", "all"]).default("navigable"),
    image: sitePathSchema.optional(),
    imageAlt: z.string().trim().max(200).optional(),
    organization: z
      .object({
        name: z.string().trim().min(1).max(120),
        legalName: z.string().trim().max(160).optional(),
        url: z.url().optional(),
        logo: sitePathSchema.optional(),
        sameAs: z.array(z.url()).max(12).default([]),
      })
      .optional(),
  })
  .default({ metatags: {}, indexing: "navigable" });

export const siteErrorsSchema = z
  .object({
    404: z
      .object({
        title: z.string().trim().max(120).optional(),
        description: z.string().trim().max(300).optional(),
        redirect: z.boolean().default(false),
      })
      .default({ redirect: false }),
  })
  .default({ 404: { redirect: false } });

export const siteThumbnailsSchema = z
  .object({
    enabled: z.boolean().default(true),
    appearance: z.enum(["light", "dark"]).default("light"),
    background: sitePathSchema.optional(),
    font: z.string().trim().max(80).optional(),
    layout: z.enum(["default", "author", "article"]).default("default"),
    label: z.string().trim().min(1).max(40).optional(),
  })
  .default({ enabled: true, appearance: "light", layout: "default" });

export const siteMarkdownSchema = z
  .object({
    instructions: z
      .union([
        z.string().trim().max(2000),
        z.array(z.string().trim().max(500)).max(20),
      ])
      .optional(),
  })
  .default({});

export const siteVariablesSchema = z
  .record(
    z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/),
    z.string().max(500)
  )
  .default({});

export const siteLayoutSchema = z
  .object({
    width: z
      .union([z.number().min(40).max(120), z.literal("full")])
      .default(72),
  })
  .default({ width: 72 });

const blogHeroSchema = z
  .object({
    style: z.enum(["wash", "plain", "image", "none"]).default("plain"),
    eyebrow: z.string().trim().max(60).optional(),
    image: sitePathSchema.optional(),
  })
  .default({ style: "plain" });

export const siteBlogSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).optional(),
  layout: z.enum(["grid", "list", "magazine", "cards"]).default("grid"),
  hero: blogHeroSchema,
  featured: z
    .union([
      z.enum(["latest", "none"]),
      z.array(z.string().trim().min(1)).max(6),
    ])
    .default("none"),
  categories: z
    .union([
      z.boolean(),
      z
        .array(z.string().trim().min(1).max(40))
        .min(1)
        .max(SITE_BLOG_CATEGORY_LIMIT),
    ])
    .default(false),
  search: z.boolean().default(false),
  card: z
    .object({
      image: z.union([z.boolean(), z.literal("auto")]).default("auto"),
      excerpt: z.boolean().default(true),
      author: z.boolean().default(true),
      date: z.boolean().default(true),
      readingTime: z.boolean().default(false),
      style: z.enum(["auto", "tile", "plain"]).default("auto"),
    })
    .default({
      image: "auto",
      excerpt: true,
      author: true,
      date: true,
      readingTime: false,
      style: "auto",
    }),
  authorPage: z.enum(["inline", "stacked"]).default("inline"),
  post: z
    .object({
      toc: z.boolean().default(true),
      authorCard: z.boolean().default(true),
      readingTime: z.boolean().default(true),
      pagination: z.boolean().default(true),
      width: z.enum(["narrow", "wide"]).default("wide"),
      header: z.enum(["stacked", "compact"]).default("stacked"),
      cover: z.boolean().default(true),
    })
    .default({
      toc: true,
      authorCard: true,
      readingTime: true,
      pagination: true,
      width: "wide",
      header: "stacked",
      cover: true,
    }),
});

export const siteChangelogSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).optional(),
  layout: z.enum(["timeline", "cards", "compact"]).default("timeline"),
  hero: blogHeroSchema,
  pageActions: z.boolean().default(false),
  minimap: z.boolean().default(true),
});

export const siteMetadataSchema = z
  .object({
    timestamp: z.boolean().default(true),
    dateFormat: z.enum(["short", "long"]).default("short"),
  })
  .default({ timestamp: true, dateFormat: "short" });
