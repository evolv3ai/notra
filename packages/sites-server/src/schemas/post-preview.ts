import { sitePreviewPasswordSchema } from "@notra/sites-core/schemas/deployment";
import { z } from "zod";

export const postPreviewAccessSchema = z.object({
  lifetime: z.enum(["1h", "1d", "3d", "7d"]),
  expiresAt: z.string(),
  password: sitePreviewPasswordSchema.nullable(),
});

export const postPreviewSourceSchema = z.object({
  /** Site generation taken when the source was written, newer than earlier removals. */
  generation: z.number().int(),
  /** The post's page in this build, kept so later slug edits don't break the link. */
  pagePath: z.string(),
  files: z.array(z.object({ path: z.string(), content: z.string() })),
  access: postPreviewAccessSchema,
});
