import "zod/compile";
import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

import {
  skillContentSchema,
  skillDescriptionSchema,
  skillNameSchema,
} from "../shared/skills";

export const createSkillSchema = z.object({
  name: skillNameSchema,
  description: skillDescriptionSchema,
  content: skillContentSchema,
});

const skillImportUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.host === "skills.sh";
    } catch {
      return false;
    }
  }, "Only skills.sh links are supported");

const updateSkillSchema = z.object({
  name: skillNameSchema.optional(),
  description: skillDescriptionSchema,
  content: skillContentSchema,
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const listSkillsInputSchema = z.object({
  organizationId: organizationIdSchema,
});

export const getSkillInputSchema = z.object({
  organizationId: organizationIdSchema,
  name: skillNameSchema,
});

export const createSkillInputSchema = z.object({
  organizationId: organizationIdSchema,
  payload: createSkillSchema,
});

export const updateSkillInputSchema = z.object({
  organizationId: organizationIdSchema,
  name: skillNameSchema,
  payload: updateSkillSchema,
});

export const deleteSkillInputSchema = z.object({
  organizationId: organizationIdSchema,
  name: skillNameSchema,
});

export const importSkillFromUrlInputSchema = z.object({
  url: skillImportUrlSchema,
});

export const syncSystemSkillInputSchema = z.object({
  organizationId: organizationIdSchema,
  name: skillNameSchema,
  keepCustomizations: z.boolean(),
  reviewedVersion: z.number().int().positive(),
  reviewedUpdatedAt: z.coerce.date(),
});
