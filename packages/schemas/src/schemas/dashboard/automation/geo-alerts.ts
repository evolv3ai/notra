import "zod/compile";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import { MAX_SCHEDULE_NAME_LENGTH } from "@notra/schemas/dashboard/integrations";
import { z } from "zod";

export const GEO_ALERT_SOURCE_TYPE = "geo_signal";
export const GEO_ALERT_OUTPUT_TYPE = "alert";

export const GEO_ALERT_SIGNALS = [
  "visibility_drop",
  "mention_lost",
  "competitor_gain",
  "citation_lost",
  "scan_failed",
  "scan_summary",
] as const;
export type GeoAlertSignal = (typeof GEO_ALERT_SIGNALS)[number];

/** Signals that fire on a minimum, with the default the form starts from. */
export const GEO_ALERT_DEFAULT_THRESHOLDS: Partial<
  Record<GeoAlertSignal, number>
> = {
  visibility_drop: 10,
  mention_lost: 1,
  competitor_gain: 1,
  citation_lost: 1,
};

export const GEO_ALERT_MAX_THRESHOLD = 100;

export const geoAlertSourceConfigSchema = z.object({
  signal: z.enum(GEO_ALERT_SIGNALS),
  /** `null` watches every GEO project in the organization. */
  projectId: z.string().min(1).nullable().default(null),
  threshold: z.number().int().min(1).max(GEO_ALERT_MAX_THRESHOLD).optional(),
});
export type GeoAlertSourceConfig = z.infer<typeof geoAlertSourceConfigSchema>;

export const geoAlertActionsSchema = z
  .object({
    slack: z.boolean(),
    email: z.boolean(),
    webhook: z.boolean(),
  })
  .refine((actions) => actions.slack || actions.email || actions.webhook, {
    message: "Pick at least one place to send the alert",
  });
export type GeoAlertActions = z.infer<typeof geoAlertActionsSchema>;

export const configureGeoAlertBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_SCHEDULE_NAME_LENGTH),
  sourceConfig: geoAlertSourceConfigSchema.refine(
    (config) =>
      config.threshold === undefined ||
      GEO_ALERT_DEFAULT_THRESHOLDS[config.signal] !== undefined,
    { message: "This signal has no threshold", path: ["threshold"] }
  ),
  actions: geoAlertActionsSchema,
  enabled: z.boolean().default(true),
});
export type ConfigureGeoAlertBody = z.infer<typeof configureGeoAlertBodySchema>;

export const createGeoAlertInputSchema = organizationIdInputSchema.extend(
  configureGeoAlertBodySchema.shape
);

export const updateGeoAlertInputSchema = createGeoAlertInputSchema.extend({
  triggerId: z.string().min(1),
});

export const geoAlertTriggerInputSchema = organizationIdInputSchema.extend({
  triggerId: z.string().min(1),
});
