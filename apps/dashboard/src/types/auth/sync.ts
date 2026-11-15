import type { User } from "@workos-inc/node";

export interface OAuthProviderTokens {
  accessToken: string;
  expiresAt?: number;
  scopes?: string[];
}

export interface SyncAuthenticatedUserInput {
  workosUser: User;
  oauthTokens?: OAuthProviderTokens;
  authenticationMethod?: string;
}
