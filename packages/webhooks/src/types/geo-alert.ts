export interface GeoAlertChange {
  readonly prompt: string;
  readonly engine: string;
  readonly kind: string;
  readonly competitors: readonly string[];
}

export interface GeoAlertWebhook {
  readonly organizationId: string;
  /** Dedupes repeat publishes, e.g. one per automation and scan. */
  readonly sourceKey: string;
  readonly automationId: string;
  readonly automationName: string;
  readonly signal: string;
  readonly projectId: string;
  readonly scanId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly url: string;
  readonly changes: readonly GeoAlertChange[];
}
