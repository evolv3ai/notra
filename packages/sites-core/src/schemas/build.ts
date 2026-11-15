import { C15T_HOST_STORAGE_KEY } from "@notra/sites-core/constants/integrations";
import { SITE_FAVICON_HOST } from "@notra/sites-core/constants/sites";
import {
  siteAreaSchema,
  siteContentSecurityPolicySchema,
  siteMountsSchema,
} from "@notra/sites-core/schemas/deployment";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import { z } from "zod";

export const siteDiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]),
  file: z.string().nullable(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  code: z.string(),
  message: z.string(),
});

export const siteBuildRequestSchema = z.object({
  siteId: z.string().min(1),
  deploymentId: z.string().min(1),
  commitSha: z.string().default(""),
  publicOrigin: z.url(),
  mounts: siteMountsSchema,
  noindex: z.boolean().default(false),
  includeDrafts: z.boolean().default(false),
  analytics: z.boolean().default(false),
  branding: z.boolean().default(true),
  defaultConfig: siteConfigSchema.optional(),
  hostingDomain: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .optional(),
});

const siteBuildRedirectSchema = z.object({
  source: z.string().startsWith("/").max(500),
  destination: z
    .string()
    .max(2000)
    .regex(/^(?:\/(?!\/)|https?:\/\/)/),
  permanent: z.boolean().default(true),
});

export const siteBuildResultSchema = z.object({
  ok: z.boolean(),
  diagnostics: z.array(siteDiagnosticSchema).max(1000),
  areas: z.array(
    z.object({
      area: siteAreaSchema,
      mount: z.string(),
      durationMs: z.number(),
    })
  ),
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  redirects: z.array(siteBuildRedirectSchema).max(500),
  contentSecurityPolicy: siteContentSecurityPolicySchema
    .nullable()
    .default(null),
  analyticsConsent: z.boolean().optional(),
  consentStorageKey: z.literal(C15T_HOST_STORAGE_KEY).optional(),
  /** Host the footer links a favicon for, the only one the worker serves. */
  faviconHost: z.string().regex(SITE_FAVICON_HOST).optional(),
});
