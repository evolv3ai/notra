import { SITE_SUSPENSION_CATEGORIES } from "@notra/sites-core/constants/sites";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import {
  SITE_ACTIVITY_DAYS,
  SITE_ANALYTICS_DAYS,
  SITE_MAX_SUSPENSION_REASON_LENGTH,
} from "@/constants/sites";

const MAX_ID = 128;
const MAX_DAYS = 90;

const idSchema = z.string().min(1).max(MAX_ID);

export const siteInputSchema = z.object({ siteId: idSchema });

export const siteDeploymentInputSchema = siteInputSchema.extend({
  deploymentId: idSchema,
});

export const siteAnalyticsInputSchema = siteInputSchema.extend({
  days: z.number().int().min(1).max(MAX_DAYS).default(SITE_ANALYTICS_DAYS),
});

export const siteBuildActivityInputSchema = z.object({
  siteId: idSchema.optional(),
  days: z.number().int().min(1).max(MAX_DAYS).default(SITE_ACTIVITY_DAYS),
});

export const suspensionReasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required")
  .max(SITE_MAX_SUSPENSION_REASON_LENGTH);

export const suspensionCategorySchema = z.enum(SITE_SUSPENSION_CATEGORIES);

export const siteSuspendInputSchema = siteInputSchema
  .extend({
    suspended: z.boolean(),
    reason: suspensionReasonSchema,
    category: suspensionCategorySchema.optional(),
  })
  .refine((input) => !input.suspended || input.category, {
    message: "Pick a category for the suspension",
    path: ["category"],
  });

/** The parts of `sites/{id}/state.json` in R2 the console reads. */
export const siteServingStateSchema = z.object({
  production: z
    .object({ deploymentId: z.string(), activatedAt: z.string() })
    .nullable(),
  previews: z
    .record(
      z.string(),
      z.object({ deploymentId: z.string(), activatedAt: z.string() })
    )
    .default({}),
});
