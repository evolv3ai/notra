import "zod/compile";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

export const updateLinearIntegrationBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    displayName: z.string().trim().min(1).optional(),
    linearTeamId: z.string().nullable().optional(),
    linearTeamName: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.enabled !== undefined ||
      value.displayName !== undefined ||
      value.linearTeamId !== undefined ||
      value.linearTeamName !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

export const linearAuthorizeQuerySchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  callbackPath: z.string().min(1).default("/"),
});

export const linearWebhookPayloadSchema = z.object({
  action: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>;
