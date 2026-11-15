import { SITE_SUSPENSION_CATEGORIES } from "@notra/sites-core/constants/sites";
import { z } from "zod";

const siteAdminBaseSchema = z.object({
  siteId: z.string().min(1),
  actorId: z.string().min(1),
});

export const siteAdminRequestSchema = z.discriminatedUnion("action", [
  siteAdminBaseSchema.extend({ action: z.literal("deployLatest") }),
  siteAdminBaseSchema.extend({
    action: z.literal("redeploy"),
    deploymentId: z.string().min(1),
  }),
  siteAdminBaseSchema.extend({
    action: z.literal("rollback"),
    deploymentId: z.string().min(1),
  }),
  siteAdminBaseSchema.extend({
    action: z.literal("setSuspended"),
    suspended: z.boolean(),
    reason: z.string().trim().min(1).max(500),
    category: z.enum(SITE_SUSPENSION_CATEGORIES).optional(),
  }),
  siteAdminBaseSchema.extend({
    action: z.literal("analytics"),
    days: z.number().int().min(1).max(90).optional(),
  }),
  z.object({
    action: z.literal("setOrganizationSuspended"),
    organizationId: z.string().min(1),
    actorId: z.string().min(1),
    suspended: z.boolean(),
    reason: z.string().trim().min(1).max(500),
    category: z.enum(SITE_SUSPENSION_CATEGORIES).optional(),
  }),
]);
