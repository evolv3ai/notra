import { z } from "zod";

const postId = z.string().trim().min(1);
const siteId = z.string().trim().min(1);
const lifetime = z.enum(["1h", "1d", "3d", "7d"]);
const password = z.string().min(8).max(128);

export const contentPreviewInputSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("list_sites"), postId }),
  z.object({
    operation: z.literal("deploy"),
    postId,
    siteId,
    lifetime: lifetime.default("1d"),
    password: password.optional(),
  }),
  z.object({ operation: z.literal("status"), postId, siteId }),
]);

// Model providers such as Anthropic require a top-level object tool schema, so
// the tool takes this flat shape and validates it with the union above.
export const contentPreviewToolInputSchema = z.object({
  operation: z.enum(["list_sites", "deploy", "status"]),
  postId,
  siteId: siteId.optional().describe("Required for deploy and status."),
  lifetime: lifetime.optional().describe("Deploy only. Defaults to 1d."),
  password: password.optional().describe("Deploy only."),
});

export const contentPreviewRequestSchema = contentPreviewInputSchema.and(
  z.object({ organizationId: z.string().trim().min(1) })
);

export const contentPreviewResultSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("list_sites"),
    sites: z.array(
      z.object({ id: siteId, name: z.string(), previewsEnabled: z.boolean() })
    ),
  }),
  z.object({
    operation: z.literal("deploy"),
    status: z.literal("queued"),
    url: z.url(),
  }),
  z.object({
    operation: z.literal("status"),
    preview: z
      .object({
        status: z.string(),
        live: z.boolean(),
        deleting: z.boolean(),
        errorMessage: z.string().nullable(),
        expiresAt: z.string(),
        hasPassword: z.boolean(),
        url: z.url(),
      })
      .nullable(),
  }),
]);
