import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import {
  INTH_OAUTH_AUTHORIZE_URL,
  INTH_OAUTH_SCOPES,
  INTH_OAUTH_STATE_KEY_PREFIX,
  INTH_OAUTH_STATE_TTL_SECONDS,
  INTH_API_URL,
} from "@notra/sites-server/constants/inth";
import {
  createInthPkce,
  getInthOAuthCredentials,
} from "@notra/sites-server/inth";
import { inthAuthorizeQuerySchema } from "@notra/sites-server/schemas/inth";
import type { InthOAuthState } from "@notra/sites-server/types/inth";
import { buildCallbackUrl } from "@notra/utils/callback-url";
import { ORPCError } from "@orpc/server";

import { SITE_ADMIN_ROLES } from "@/constants/sites";
import { redirectResponse } from "@/lib/auth/http";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { getInthRedirectUri } from "@/lib/integrations/inth/redirect-uri";
import { ratelimit } from "@/utils/ratelimit";

export async function GET(request: Request) {
  const baseUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  try {
    const { searchParams } = new URL(request.url);
    const parsed = inthAuthorizeQuerySchema.safeParse({
      organizationId: searchParams.get("organizationId") ?? undefined,
      callbackPath: searchParams.get("callbackPath") ?? undefined,
    });
    if (!parsed.success) {
      return redirectResponse(`${baseUrl}/?error=invalid_request`);
    }
    const { organizationId, callbackPath } = parsed.data;

    let userId: string;
    try {
      const access = await assertOrganizationAccess({
        headers: request.headers,
        organizationId,
      });
      if (!SITE_ADMIN_ROLES.has(access.membership.role)) {
        return redirectResponse(
          buildCallbackUrl(baseUrl, callbackPath, { error: "inth_forbidden" })
        );
      }
      userId = access.user.id;
    } catch (error) {
      if (error instanceof ORPCError) {
        return redirectResponse(
          buildCallbackUrl(baseUrl, callbackPath, { error: "inth_forbidden" })
        );
      }
      throw error;
    }

    const { success: withinLimit } = await ratelimit.inthOAuth.limit(userId);
    if (!withinLimit) {
      return redirectResponse(
        buildCallbackUrl(baseUrl, callbackPath, { error: "inth_rate_limited" })
      );
    }

    const credentials = getInthOAuthCredentials();
    if (!(credentials && redis)) {
      return redirectResponse(
        buildCallbackUrl(baseUrl, callbackPath, {
          error: "inth_not_configured",
        })
      );
    }

    const state = crypto.randomUUID();
    const pkce = createInthPkce();
    const oauthState: InthOAuthState = {
      organizationId,
      userId,
      callbackPath,
      codeVerifier: pkce.verifier,
    };
    await redis.set(
      `${INTH_OAUTH_STATE_KEY_PREFIX}${state}`,
      JSON.stringify(oauthState),
      { ex: INTH_OAUTH_STATE_TTL_SECONDS }
    );

    const authUrl = new URL(INTH_OAUTH_AUTHORIZE_URL);
    authUrl.searchParams.set("client_id", credentials.clientId);
    authUrl.searchParams.set("redirect_uri", getInthRedirectUri(baseUrl));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", INTH_OAUTH_SCOPES.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", pkce.challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("resource", INTH_API_URL);
    authUrl.searchParams.set("prompt", "consent");

    return redirectResponse(authUrl.toString());
  } catch (error) {
    logError("Error initiating Inth OAuth", error);
    return redirectResponse(`${baseUrl}/?error=inth_auth_failed`);
  }
}
