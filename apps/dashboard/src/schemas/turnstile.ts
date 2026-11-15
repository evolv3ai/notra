import { z } from "zod";

export const turnstileTokenSchema = z.string().trim().min(1).max(2048);

export const turnstileVerificationSchema = z.object({
  success: z.literal(true),
  hostname: z.string(),
  action: z.string(),
});
