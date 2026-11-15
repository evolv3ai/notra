import "zod/compile";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

const updateNotificationSettingsSchema = z.object({
  scheduledContentCreation: z.boolean().optional(),
  scheduledContentFailed: z.boolean().optional(),
  scheduledContentSkipped: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
});

export const updateNotificationSettingsInputSchema =
  organizationIdInputSchema.extend(updateNotificationSettingsSchema.shape);

export const onboardingNotificationPrefsSchema = z.object({
  dailySummary: z.boolean(),
  marketingEmails: z.boolean(),
});

export const updateMarketingEmailsInputSchema = z.object({
  enabled: z.boolean(),
});
