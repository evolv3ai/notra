import type { inthIntegrations } from "@notra/db/schema";
import type { z } from "zod";

import type { inthOAuthStateSchema, inthProjectSchema } from "../schemas/inth";

export type InthIntegrationRow = typeof inthIntegrations.$inferSelect;
export type InthProject = z.infer<typeof inthProjectSchema>;
export type InthOAuthState = z.infer<typeof inthOAuthStateSchema>;

export interface InthOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export interface InthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface InthProjectSummary {
  id: string;
  name: string;
  organizationSlug: string;
  dashboardUrl: string;
  backendUrl: string | null;
}

export interface InthConsentStatus {
  configured: boolean;
  connected: boolean;
  reauthRequired: boolean;
  project: InthProjectSummary | null;
  missingOrigins: string[];
}

export type InthErrorCode =
  | "not_configured"
  | "not_connected"
  | "reauth_required"
  | "project_not_found"
  | "no_backend"
  | "api_error";

export interface ExchangeInthAuthorizationCodeParams {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface SaveInthIntegrationParams {
  organizationId: string;
  userId: string;
  tokens: InthTokens;
}
