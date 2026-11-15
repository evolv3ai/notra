import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import {
  INTH_OAUTH_CALLBACK_PATH,
  INTH_OAUTH_STATE_KEY_PREFIX,
} from "@notra/sites-server/constants/inth";
import {
  exchangeInthAuthorizationCode,
  saveInthIntegration,
} from "@notra/sites-server/inth";
import { inthOAuthStateSchema } from "@notra/sites-server/schemas/inth";
import { buildCallbackUrl } from "@notra/utils/callback-url";

import { SITE_ADMIN_ROLES } from "@/constants/sites";
import { redirectResponse } from "@/lib/auth/http";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { getServerSession } from "@/lib/auth/session";
import { getInthRedirectUri } from "@/lib/integrations/inth/redirect-uri";

export async function GET(request: Request) {
  const baseUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let callbackPath = "/";

  try {
    const requestUrl = new URL(request.url);
    const baseHost = baseUrl ? new URL(baseUrl).host : null;
    const forwardedHost =
      request.headers.get("x-forwarded-host") ?? requestUrl.host;
    if (baseHost && forwardedHost !== baseHost) {
      return redirectResponse(
        `${baseUrl}${INTH_OAUTH_CALLBACK_PATH}${requestUrl.search}`
      );
    }

    const { searchParams } = requestUrl;
    const state = searchParams.get("state");
    if (!(state && redis)) {
      return redirectResponse(`${baseUrl}/?error=invalid_callback`);
    }
    const raw = await redis.getdel<unknown>(
      `${INTH_OAUTH_STATE_KEY_PREFIX}${state}`
    );
    const parsedState = inthOAuthStateSchema.safeParse(
      typeof raw === "string" ? JSON.parse(raw) : raw
    );
    if (!parsedState.success) {
      return redirectResponse(`${baseUrl}/?error=inth_expired_state`);
    }
    const oauthState = parsedState.data;
    callbackPath = oauthState.callbackPath;

    const error = searchParams.get("error");
    if (error) {
      return redirectResponse(
        buildCallbackUrl(baseUrl, callbackPath, {
          error:
            error === "access_denied"
              ? "inth_access_denied"
              : "inth_auth_failed",
        })
      );
    }
    const code = searchParams.get("code");
    if (!code) {
      return redirectResponse(
        buildCallbackUrl(baseUrl, callbackPath, {
          error: "inth_invalid_callback",
        })
      );
    }

    const { session, user } = await getServerSession({
      headers: request.headers,
    });
    if (session?.userId !== oauthState.userId) {
      return redirectResponse(
        buildCallbackUrl(baseUrl, callbackPath, {
          error: "inth_session_mismatch",
        })
      );
    }
    const access = await assertOrganizationAccess({
      headers: request.headers,
      organizationId: oauthState.organizationId,
      user,
    });
    if (!SITE_ADMIN_ROLES.has(access.membership.role)) {
      return redirectResponse(
        buildCallbackUrl(baseUrl, callbackPath, { error: "inth_forbidden" })
      );
    }

    const tokens = await exchangeInthAuthorizationCode({
      code,
      redirectUri: getInthRedirectUri(baseUrl),
      codeVerifier: oauthState.codeVerifier,
    });
    await saveInthIntegration({
      organizationId: oauthState.organizationId,
      userId: oauthState.userId,
      tokens,
    });

    return redirectResponse(
      buildCallbackUrl(baseUrl, callbackPath, { inthConnected: "true" })
    );
  } catch (error) {
    logError("Error in Inth OAuth callback", error);
    return redirectResponse(
      buildCallbackUrl(baseUrl, callbackPath, { error: "inth_auth_failed" })
    );
  }
}
