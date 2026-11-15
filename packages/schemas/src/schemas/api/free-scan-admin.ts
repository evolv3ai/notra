import { z } from "zod";

const HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

export const freeScanAdminRunInputSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(HOSTNAME_PATTERN, "Enter a bare domain such as acme.com"),
});

export const freeScanAdminRunResponseSchema = z.discriminatedUnion("started", [
  z.object({
    started: z.literal(true),
    scanId: z.string(),
    promptCount: z.number(),
  }),
  z.object({ started: z.literal(false), reason: z.string() }),
]);
