import { z } from "zod";

const linearOAuthStateObjectSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  callbackPath: z.string(),
});

export const linearOAuthStateSchema = z.union([
  linearOAuthStateObjectSchema,
  z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid JSON" });
        return z.NEVER;
      }
    })
    .pipe(linearOAuthStateObjectSchema),
]);

export const linearTokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

export const linearOrganizationQuerySchema = z.object({
  data: z.object({
    organization: z.object({
      id: z.string().min(1),
      name: z.string(),
    }),
  }),
});
