import { z } from "zod";

import { INTH_CALLBACK_PATH_MAX_LENGTH } from "../constants/inth";

export const inthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
});

export const inthTokenErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

export const inthProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationSlug: z.string(),
  dashboardUrl: z.string(),
  websites: z.array(z.object({ origin: z.string() })),
  consent: z
    .object({ backendUrl: z.string().nullable(), branding: z.string() })
    .nullable(),
});

export const inthProjectResponseSchema = z.object({
  data: inthProjectSchema,
});

export const inthProjectListResponseSchema = z.object({
  data: z.array(inthProjectSchema),
  pagination: z
    .object({ nextCursor: z.string().nullable().optional() })
    .optional(),
});

export const inthOAuthStateSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  callbackPath: z.string(),
  codeVerifier: z.string(),
});

export const inthAuthorizeQuerySchema = z.object({
  organizationId: z.string().min(1),
  callbackPath: z
    .string()
    .min(1)
    .max(INTH_CALLBACK_PATH_MAX_LENGTH)
    .refine((path) => path.startsWith("/") && !path.startsWith("//"))
    .default("/"),
});
