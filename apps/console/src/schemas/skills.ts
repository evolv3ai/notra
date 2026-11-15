import {
  skillContentSchema,
  skillDescriptionSchema,
  skillNameSchema,
} from "@notra/schemas/shared/skills";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

export const systemSkillNameInputSchema = z.object({
  name: skillNameSchema,
});

export const publishSystemSkillInputSchema = z.object({
  name: skillNameSchema.refine((name) => name !== "new", "Choose another name"),
  description: skillDescriptionSchema,
  content: skillContentSchema,
  note: z.string().trim().max(2000, "Note is too long").optional(),
  expectedVersion: z.number().int().positive().nullable(),
});
