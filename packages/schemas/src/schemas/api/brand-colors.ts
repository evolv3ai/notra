import "zod/compile";
import { z } from "@hono/zod-openapi";

import { BRAND_GUIDELINE_HEX_COLOR_REGEX } from "../../constants/dashboard/brand-guidelines";
import {
  getBrandIdentityParamsSchema,
  organizationResponseSchema,
} from "./content";
import { resourceIdSchema } from "./ids";

const brandColorRoleSchema = z
  .enum([
    "primary",
    "secondary",
    "accent",
    "background",
    "foreground",
    "neutral",
    "custom",
  ])
  .openapi({ example: "primary" });

const hexColorSchema = z
  .string()
  .trim()
  .regex(BRAND_GUIDELINE_HEX_COLOR_REGEX, "Must be a hex color like #13A0DC");

const brandColorSchema = z.object({
  id: z.string(),
  role: brandColorRoleSchema,
  name: z.string().nullable(),
  lightValue: z.string().openapi({ example: "#13A0DC" }),
  darkValue: z.string().nullable(),
  usage: z.string().nullable(),
});

export const brandColorParamsSchema = getBrandIdentityParamsSchema.extend({
  colorId: resourceIdSchema("colorId").openapi({
    param: { in: "path", name: "colorId" },
    example: "8f2c1d4e-5b6a-4c3d-9e8f-7a6b5c4d3e2f",
  }),
});

export const createBrandColorRequestSchema = z.object({
  role: brandColorRoleSchema.default("custom"),
  name: z.string().trim().max(120).nullable().optional(),
  lightValue: hexColorSchema.openapi({ example: "#13A0DC" }),
  darkValue: hexColorSchema.nullable().optional(),
  usage: z.string().trim().max(240).nullable().optional(),
});

export const patchBrandColorRequestSchema = createBrandColorRequestSchema
  .extend({
    role: brandColorRoleSchema.optional(),
    lightValue: hexColorSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const listBrandColorsResponseSchema = z.object({
  organization: organizationResponseSchema,
  colors: z.array(brandColorSchema),
});

export const brandColorResponseSchema = z.object({
  organization: organizationResponseSchema,
  color: brandColorSchema,
});

export const deleteBrandColorResponseSchema = z.object({
  organization: organizationResponseSchema,
  id: z.string(),
});
