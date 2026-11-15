import {
  OG_FONT_WEIGHTS,
  OG_HEX_COLOR,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from "@notra/ai/constants/og-image";
import { GATEWAY_FALLBACK_ORDER } from "@notra/ai/constants/router";
import { z } from "zod";

const color = z.string().regex(OG_HEX_COLOR);
const bounds = {
  x: z.number().min(0).max(OG_IMAGE_WIDTH),
  y: z.number().min(0).max(OG_IMAGE_HEIGHT),
  width: z.number().positive().max(OG_IMAGE_WIDTH),
  height: z.number().positive().max(OG_IMAGE_HEIGHT),
};
const layer = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("artwork"),
    ...bounds,
    svg: z.string().min(1).max(24_000),
    opacity: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("rect"),
    ...bounds,
    color,
    radius: z.number().min(0).max(300),
    opacity: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("image"),
    decorative: z.boolean().optional(),
    color: color.nullable(),
    ...bounds,
    assetId: z.string().min(1).max(100),
    opacity: z.number().min(0).max(1),
    fit: z.enum(["contain", "cover", "fill"]),
    crop: z
      .object({
        left: z.number().min(0).max(1),
        top: z.number().min(0).max(1),
        width: z.number().positive().max(1),
        height: z.number().positive().max(1),
      })
      .nullable(),
  }),
  z.object({
    kind: z.literal("text"),
    ...bounds,
    text: z.string().min(1).max(120),
    color,
    size: z.number().min(14).max(48),
    align: z.enum(["left", "center", "right"]),
  }),
]);

export const ogTemplateSchema = z.object({
  background: color,
  font: z.object({
    family: z.string().min(1).max(100),
    weight: z.literal(OG_FONT_WEIGHTS),
    url: z.url().nullable(),
  }),
  title: z.object({
    ...bounds,
    color,
    size: z.number().min(40).max(88),
    minSize: z.number().min(24).max(40),
    lineHeight: z.number().min(1).max(1.4),
    letterSpacing: z.number().min(-3).max(1),
    align: z.enum(["left", "center", "right"]),
  }),
  layers: z.array(layer).max(32),
});

export const ogImageInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  brandIdentityId: z.string().trim().min(1).optional(),
});

export const savedOgTemplateSchema = z.object({
  version: z.literal(1),
  template: ogTemplateSchema,
  fontBase64: z.string().min(1).max(4_000_000),
  assets: z.record(z.string(), z.string().max(3_000_000)),
  warnings: z.array(z.string()).max(30),
});

export const ogImageResultSchema = z.object({
  imageUrl: z.url(),
  title: z.string(),
  brandIdentityId: z.string(),
  width: z.literal(1200),
  height: z.literal(630),
  templateSource: z.enum(["generated", "cached", "last-good", "fallback"]),
  warnings: z.array(z.string()),
});

export const ogImageReviewSchema = z.object({
  approved: z.boolean(),
  assetIntegrity: z
    .boolean()
    .describe(
      "Every source crop is free of cut-off letters/logos and unrelated text; artwork edges blend intentionally or form a deliberate panel, not a pasted rectangular fragment."
    ),
  brandFidelity: z.number().min(0).max(10),
  typography: z.number().min(0).max(10),
  composition: z.number().min(0).max(10),
  reason: z.string().max(2000),
});

export const ogSavedGuidelineEvidenceSchema = z.object({
  colors: z.array(z.unknown()).catch([]),
  fonts: z.array(z.unknown()).catch([]),
  screenshots: z
    .array(
      z.object({
        url: z.url(),
        capturedAt: z.coerce.date().nullish(),
        metadata: z.object({ domain: z.string().optional() }).nullish(),
      })
    )
    .catch([]),
});

export const ogCallRouteSchema = z.object({
  gateway: z.enum(GATEWAY_FALLBACK_ORDER),
  requestedModel: z.string(),
  model: z.string(),
  reason: z.enum(["pinned", "no-org-default", "paid", "free", "fallback"]),
  organizationId: z.string().optional(),
  generationId: z.string().optional(),
});
