import type {
  ANALYTICS_VIEW_STATES,
  BRAND_REFERENCE_SOURCES,
  INTEGRATION_AUTH_KINDS,
  INTEGRATION_PROVIDERS,
} from "@/constants/integration-analytics";

type IntegrationProvider =
  (typeof INTEGRATION_PROVIDERS)[keyof typeof INTEGRATION_PROVIDERS];

export type IntegrationAuthKind =
  (typeof INTEGRATION_AUTH_KINDS)[keyof typeof INTEGRATION_AUTH_KINDS];
export type AnalyticsViewState =
  (typeof ANALYTICS_VIEW_STATES)[keyof typeof ANALYTICS_VIEW_STATES];
export type BrandReferenceSource =
  (typeof BRAND_REFERENCE_SOURCES)[keyof typeof BRAND_REFERENCE_SOURCES];

export interface TrackIntegrationConnectedInput {
  headers: Headers;
  userId?: string | null;
  organizationId?: string | null;
  provider: IntegrationProvider;
  authKind: IntegrationAuthKind;
}

export interface TrackIntegrationConnectFailedInput extends TrackIntegrationConnectedInput {
  errorCode: string;
}
