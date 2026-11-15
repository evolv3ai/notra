import type {
  SiteIntegrationUpdate,
  SiteIntegrations,
} from "@notra/sites-core/types/site-integrations";

export interface SiteIntegrationConfigUpdate {
  provider: keyof SiteIntegrations;
  settings: Record<string, unknown> | null;
}

export interface SiteIntegrationsState {
  integrations: Record<string, unknown>;
  hasDraft: boolean;
  invalid: boolean;
}

export type SaveSiteIntegrationsInput = SiteIntegrationUpdate & {
  userId: string;
  branch?: string;
};
