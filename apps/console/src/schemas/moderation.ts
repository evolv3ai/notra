// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import {
  suspensionCategorySchema,
  suspensionReasonSchema,
} from "@/schemas/sites";

const idSchema = z.string().min(1).max(128);

export const moderationSearchInputSchema = z.object({
  search: z.string().trim().max(200).default(""),
});

/**
 * No category check here: "Finish suspension" repeats a suspension without
 * one and keeps the original, so the site admin route requires a category
 * only for a new suspension.
 */
export const organizationSuspendInputSchema = z.object({
  organizationId: idSchema,
  suspended: z.boolean(),
  reason: suspensionReasonSchema,
  category: suspensionCategorySchema.optional(),
});

export const userBanInputSchema = z
  .object({
    userId: idSchema,
    banned: z.boolean(),
    reason: suspensionReasonSchema,
    category: suspensionCategorySchema.optional(),
    suspendOrganizations: z.boolean().default(false),
  })
  .refine((input) => !input.suspendOrganizations || input.category, {
    message: "Pick a category to suspend their workspaces",
    path: ["category"],
  });
