import "zod/compile";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

export const onboardingAgentWorkflowPayloadSchema = z.object({
  organizationId: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  reservedAt: z.iso.datetime(),
});
