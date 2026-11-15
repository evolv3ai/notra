// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import {
  AI_TRENDS_DAY_OPTIONS,
  AI_TRENDS_DEFAULT_DAYS,
} from "@/constants/ai-trends";
import { normalizeTrendsDomain } from "@/utils/ai-trends";

const MAX_DOMAIN = 253;
const DOMAIN_PATTERN = /^[a-z0-9.-]+$/;

export const aiTrendsOverviewInputSchema = z.object({
  days: z.literal(AI_TRENDS_DAY_OPTIONS).default(AI_TRENDS_DEFAULT_DAYS),
});

/**
 * Stored citation domains drop the scheme, path and `www.`/`m.`-style
 * prefixes, so a pasted URL or `www.reddit.com` must too before matching.
 */
export const aiTrendsDomainInputSchema = aiTrendsOverviewInputSchema.extend({
  domain: z
    .string()
    .transform(normalizeTrendsDomain)
    .pipe(z.string().min(1).max(MAX_DOMAIN).regex(DOMAIN_PATTERN)),
});

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_CARD_DAYS = 120;
const MAX_LOGO_SVG = 24_000;

/** Engine logos arrive as the SVG the page already drew; domains by name. */
const logoSvgSchema = z
  .string()
  .max(MAX_LOGO_SVG)
  .refine((svg) => svg.startsWith("<svg") && !svg.includes("<script"));

const shareCardIconSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("engine"), svg: logoSvgSchema }),
  z.object({
    kind: z.literal("domain"),
    value: z.string().trim().min(1).max(MAX_DOMAIN).regex(DOMAIN_PATTERN),
  }),
]);

/** Everything the share image draws; the client already holds the data. */
export const aiTrendsShareCardSchema = z.object({
  theme: z.enum(["light", "dark"]).default("light"),
  /** Small caption above the headline, e.g. the engine. */
  eyebrow: z.string().max(60),
  title: z.object({
    before: z.string().max(80),
    highlight: z.string().min(1).max(60),
    after: z.string().max(80),
    /** A domain the title names, drawn with its favicon. */
    domain: z.string().max(MAX_DOMAIN).regex(DOMAIN_PATTERN).optional(),
  }),
  description: z.string().max(280),
  icons: z.array(shareCardIconSchema).max(3),
  stats: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.string().max(24),
        change: z.number().finite().nullable(),
        hint: z.string().max(60),
      })
    )
    .max(2),
  format: z.enum(["share", "count", "visits"]),
  axisLabel: z.string().max(40),
  days: z.array(z.string().regex(DAY_PATTERN)).min(2).max(MAX_CARD_DAYS),
  markDay: z.string().regex(DAY_PATTERN).nullable(),
  series: z
    .array(
      z.object({
        label: z.string().max(60),
        logo: logoSvgSchema.nullable(),
        color: z.string().regex(COLOR_PATTERN),
        darkColor: z.string().regex(COLOR_PATTERN),
        values: z.array(z.number().finite()).max(MAX_CARD_DAYS),
      })
    )
    .min(1)
    .max(6),
});
