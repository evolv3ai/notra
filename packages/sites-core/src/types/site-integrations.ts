import type { DatabuddyConfig } from "@databuddy/sdk";
import type {
  siteIntegrationSchemas,
  siteIntegrationUpdateSchema,
  siteIntegrationsSchema,
  siteSecuritySchema,
} from "@notra/sites-core/schemas/site-integrations";
import type { z } from "zod";

export type SiteIntegrations = z.infer<typeof siteIntegrationsSchema>;
export type SiteIntegrationName = keyof typeof siteIntegrationSchemas;
export type SiteC15t = NonNullable<SiteIntegrations["c15t"]>;
export type SiteDatabuddy = NonNullable<SiteIntegrations["databuddy"]>;
export type SiteIntegrationUpdate = z.infer<typeof siteIntegrationUpdateSchema>;
type SiteSecurity = z.infer<typeof siteSecuritySchema>;

export type SiteHeadScript =
  | { kind: "external"; src: string; attributes: Record<string, string | true> }
  | { kind: "inline"; code: string };

export interface SiteCspSources {
  scriptSrc: string[];
  connectSrc: string[];
}

export interface SiteContentSecurityPolicyParams {
  integrations: SiteIntegrations;
  security: SiteSecurity;
  scriptHashes: Iterable<string>;
}

type DatabuddyScriptOptions = Omit<
  DatabuddyConfig,
  "debug" | "disabled" | "filter" | "scriptIntegrity" | "sdk" | "sdkVersion"
>;

export type DatabuddySchemaShape = {
  [K in keyof DatabuddyScriptOptions]-?: z.ZodType<DatabuddyScriptOptions[K]>;
};
