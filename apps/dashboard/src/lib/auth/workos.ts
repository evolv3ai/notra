import { sanitizeReturnTo } from "@notra/utils/auth-redirect";
import {
  getConfig,
  getWorkOS,
  selectStalePKCEVerifierCookieNames,
  sessionEncryption,
  type Session,
} from "@workos/authkit-session";
import {
  getAuthkit,
  getAuthKitContext,
} from "@workos/authkit-tanstack-react-start";

import {
  clearHostAuthSessionCookie,
  markAuthSessionCleared,
} from "@/lib/auth/session-cookie";
import type { SignOutActionOptions } from "@/types/auth/user-actions";

export async function createAuthSignInUrl() {
  const context = getAuthKitContext();
  const authkit = await getAuthkit();
  const result = await authkit.createSignIn(undefined, {
    redirectUri: context.redirectUri,
  });
  const cookieNames = (context.request.headers.get("cookie") ?? "")
    .split(";")
    .map((cookie) => cookie.slice(0, cookie.indexOf("=")).trim())
    .filter(Boolean);
  const stale = selectStalePKCEVerifierCookieNames(cookieNames, {
    keep: result.cookieName,
  });
  await Promise.allSettled(
    stale.map((cookieName) =>
      authkit.clearPendingVerifierByName(undefined, {
        cookieName,
        redirectUri: context.redirectUri,
      })
    )
  );
  return result.url;
}

export async function signOutAuthSession(options?: SignOutActionOptions) {
  const auth = getAuthKitContext().auth();
  if (auth.user && auth.sessionId) {
    await getWorkOS().userManagement.revokeSession({
      sessionId: auth.sessionId,
    });
  }
  const authkit = await getAuthkit();
  await authkit.clearSession(new Response());
  clearHostAuthSessionCookie();
  markAuthSessionCleared(getAuthKitContext().request);
  return sanitizeReturnTo(options?.returnTo ?? null) ?? "/login";
}

export async function saveAuthSession(session: Session) {
  getAuthKitContext();
  const [encrypted, authkit] = await Promise.all([
    sessionEncryption.sealData(session, {
      password: getConfig("cookiePassword"),
      ttl: 0,
    }),
    getAuthkit(),
  ]);
  await authkit.saveSession(undefined, encrypted);
  clearHostAuthSessionCookie();
}
