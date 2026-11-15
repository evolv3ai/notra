import { z } from "zod";

const metadataSchema = z.record(z.string(), z.string());

// Billing mutations reach Autumn with the secret key, so these schemas strip
// every field the dashboard does not send (price overrides, trials, discounts,
// invoice and refund options).
export const autumnAttachBodySchema = z.object({
  planId: z.string().min(1),
  metadata: metadataSchema.optional(),
  redirectMode: z.string().optional(),
  successUrl: z.string().optional(),
  featureQuantities: z
    .array(
      z.object({
        featureId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
});

export const autumnMultiAttachBodySchema = z.object({
  plans: z.array(z.object({ planId: z.string().min(1) })).min(1),
  checkoutSessionParams: z
    .object({
      metadata: metadataSchema.optional(),
      subscription_data: z
        .object({ metadata: metadataSchema.optional() })
        .optional(),
    })
    .optional(),
  redirectMode: z.string().optional(),
  successUrl: z.string().optional(),
});

export const autumnUpdateSubscriptionBodySchema = z.object({
  planId: z.string().min(1),
  cancelAction: z.literal("cancel_end_of_cycle").optional(),
});

export const autumnOpenCustomerPortalBodySchema = z.object({
  returnUrl: z.string().optional(),
});
