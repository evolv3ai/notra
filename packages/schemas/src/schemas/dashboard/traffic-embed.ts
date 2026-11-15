import "zod/compile";
import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

export const TRAFFIC_EMBED_NAME_MAX_LENGTH = 80;
const TRAFFIC_EMBED_MAX_ORIGINS = 10;
const TRAFFIC_EMBED_ORIGIN_MAX_LENGTH = 253;
const TRAFFIC_EMBED_HOST_MAX_LENGTH = 253;

const embedOriginsSchema = z
  .array(z.string().trim().min(1).max(TRAFFIC_EMBED_ORIGIN_MAX_LENGTH))
  .min(1)
  .max(TRAFFIC_EMBED_MAX_ORIGINS);

const embedNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(TRAFFIC_EMBED_NAME_MAX_LENGTH);

export const listTrafficEmbedsInputSchema = z.object({
  organizationId: organizationIdSchema,
  projectId: z.string().min(1).optional(),
});

export const createTrafficEmbedInputSchema =
  listTrafficEmbedsInputSchema.extend({
    name: embedNameSchema,
    host: z.string().trim().max(TRAFFIC_EMBED_HOST_MAX_LENGTH).optional(),
    allowedOrigins: embedOriginsSchema,
  });

export const trafficEmbedInputSchema = z.object({
  organizationId: organizationIdSchema,
  embedId: z.string().min(1).max(64),
});

export const updateTrafficEmbedInputSchema = trafficEmbedInputSchema.extend({
  name: embedNameSchema,
  allowedOrigins: embedOriginsSchema,
});
