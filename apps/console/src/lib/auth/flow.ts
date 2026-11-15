import { createHash } from "node:crypto";

import { redis } from "@notra/ai/utils/redis";
import { workosErrorSchema } from "@notra/schemas/dashboard/auth/workos-error";
import type {
  AuthFlowResult,
  PendingAuthStep,
} from "@notra/schemas/types/dashboard/auth";
import { sanitizeReturnTo } from "@notra/utils/auth-redirect";
import { getWorkOS, saveSession } from "@workos-inc/authkit-nextjs";
import type { AuthenticationResponse } from "@workos-inc/node";
import { Effect } from "effect";
import { cookies, headers } from "next/headers";

import {
  CONSOLE_AUTH_TTL_SECONDS,
  CONSOLE_PENDING_AUTH_COOKIE,
} from "@/constants/auth";
import { ensureLocalUser } from "@/lib/auth/sync";
import { assertRateLimit } from "@/lib/orpc/utils/rate-limit";
import type { ConsolePendingAuthContext } from "@/types/auth";
import { isUserBanned } from "@/utils/ban";

export function consoleAppUrl() {
  return process.env.CONSOLE_APP_URL ?? "http://localhost:3003";
}

export async function limitConsoleSignIn(identifier?: string) {
  const requestHeaders = await headers();
  const ip =
    process.env.VERCEL === "1"
      ? (requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown")
      : "unknown";
  await assertRateLimit({
    key: `sign-in:ip:${ip}`,
    limit: 20,
    windowSeconds: 60,
  });
  if (identifier) {
    const account = createHash("sha256")
      .update(identifier.toLowerCase())
      .digest("hex");
    await assertRateLimit({
      key: `sign-in:account:${account}`,
      limit: 10,
      windowSeconds: 60,
    });
  }
}

function pendingAccountKey(token: string) {
  return `console:auth-account:${createHash("sha256").update(token).digest("hex")}`;
}

export async function limitPendingConsoleSignIn(token: string) {
  const context = redis
    ? await redis.get<ConsolePendingAuthContext>(pendingAccountKey(token))
    : null;
  await limitConsoleSignIn(context?.identifier);
  return context;
}

export async function rememberPendingAuth(step: PendingAuthStep) {
  if (!redis) {
    throw new Error("Shared sign-in state is not configured");
  }
  const cookieStore = await cookies();
  const previous = cookieStore.get(CONSOLE_PENDING_AUTH_COOKIE)?.value;
  if (previous) {
    await redis.del(`console:pending-auth:${previous}`);
  }
  const nonce = crypto.randomUUID();
  await redis.set(`console:pending-auth:${nonce}`, step, {
    ex: CONSOLE_AUTH_TTL_SECONDS,
  });
  cookieStore.set(CONSOLE_PENDING_AUTH_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: consoleAppUrl().startsWith("https://"),
    path: "/",
    maxAge: CONSOLE_AUTH_TTL_SECONDS,
  });
}

export async function readPendingAuth() {
  const nonce = (await cookies()).get(CONSOLE_PENDING_AUTH_COOKIE)?.value;
  return nonce && redis
    ? ((await redis.get<PendingAuthStep>(`console:pending-auth:${nonce}`)) ??
        undefined)
    : undefined;
}

async function completeAuthentication(
  response: AuthenticationResponse,
  returnTo?: string | null
): Promise<AuthFlowResult> {
  const user = await Effect.runPromise(ensureLocalUser(response.user));
  if (isUserBanned(user)) {
    return { status: "error", message: "Your account has been suspended." };
  }
  await saveSession(
    {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
      impersonator: response.impersonator,
      authenticationMethod: response.authenticationMethod,
    },
    consoleAppUrl()
  );
  const cookieStore = await cookies();
  const nonce = cookieStore.get(CONSOLE_PENDING_AUTH_COOKIE)?.value;
  if (nonce && redis) {
    await redis.del(`console:pending-auth:${nonce}`).catch(() => undefined);
  }
  cookieStore.delete(CONSOLE_PENDING_AUTH_COOKIE);
  return {
    status: "success",
    redirectTo: sanitizeReturnTo(returnTo ?? null) ?? "/dashboard",
  };
}

async function authenticate(run: () => Promise<AuthenticationResponse>) {
  try {
    return await run();
  } catch (error) {
    const parsed = workosErrorSchema.safeParse(error);
    const info = parsed.success ? parsed.data.rawData : undefined;
    if (
      (info?.code ?? (parsed.success ? parsed.data.code : undefined)) !==
        "organization_selection_required" ||
      !info?.pending_authentication_token ||
      !info.organizations?.[0]
    ) {
      throw error;
    }
    return getWorkOS().userManagement.authenticateWithOrganizationSelection({
      clientId: process.env.WORKOS_CLIENT_ID ?? "",
      pendingAuthenticationToken: info.pending_authentication_token,
      organizationId: info.organizations[0].id,
    });
  }
}

async function authenticationFailure(
  error: unknown,
  email: string,
  accountIdentifier?: string
): Promise<AuthFlowResult> {
  const parsed = workosErrorSchema.safeParse(error);
  const info = parsed.success ? parsed.data.rawData : undefined;
  const code = info?.code ?? (parsed.success ? parsed.data.code : undefined);
  const token = info?.pending_authentication_token;
  const resolvedEmail = email || info?.email || info?.user?.email || "";
  if (
    token &&
    (code === "email_verification_required" ||
      code === "mfa_challenge" ||
      code === "mfa_enrollment")
  ) {
    const identifier = accountIdentifier || resolvedEmail || info?.user?.id;
    if (!(redis && identifier)) {
      return {
        status: "error",
        message: "Could not preserve the sign-in session. Please try again.",
      };
    }
    const context: ConsolePendingAuthContext = {
      identifier,
      email: resolvedEmail,
    };
    await redis.set(pendingAccountKey(token), context, {
      ex: CONSOLE_AUTH_TTL_SECONDS,
    });
  }
  if (token && code === "email_verification_required") {
    return {
      status: "verification-required",
      pendingAuthenticationToken: token,
      email: resolvedEmail,
    };
  }
  if (token && code === "mfa_challenge") {
    const factor = info?.authentication_factors?.find(
      (item) => item.type === "totp"
    );
    if (factor) {
      const challenge = await getWorkOS().multiFactorAuth.challengeFactor({
        authenticationFactorId: factor.id,
      });
      return {
        status: "mfa-required",
        pendingAuthenticationToken: token,
        authenticationChallengeId: challenge.id,
        email: resolvedEmail,
      };
    }
  }
  if (token && code === "mfa_enrollment" && info?.user?.id) {
    const enrollment = await getWorkOS().multiFactorAuth.createUserAuthFactor({
      userId: info.user.id,
      type: "totp",
      totpIssuer: "Notra",
      totpUser: resolvedEmail,
    });
    return {
      status: "mfa-enrollment-required",
      pendingAuthenticationToken: token,
      email: resolvedEmail,
      factorId: enrollment.authenticationFactor.id,
      authenticationChallengeId: enrollment.authenticationChallenge.id,
      qrCode: enrollment.authenticationFactor.totp.qrCode,
      secret: enrollment.authenticationFactor.totp.secret,
      otpauthUri: enrollment.authenticationFactor.totp.uri,
    };
  }
  return {
    status: "error",
    message:
      code === "invalid_credentials"
        ? "Email or password is incorrect."
        : "Could not complete sign-in. Please try again.",
  };
}

export async function runConsoleAuth(
  run: () => Promise<AuthenticationResponse>,
  email: string,
  returnTo?: string | null,
  accountIdentifier?: string
): Promise<AuthFlowResult> {
  try {
    let response: AuthenticationResponse;
    try {
      response = await authenticate(run);
    } catch (error) {
      return await authenticationFailure(error, email, accountIdentifier);
    }
    return await completeAuthentication(response, returnTo);
  } catch {
    return {
      status: "error",
      message: "Sign-in is temporarily unavailable. Please try again.",
    };
  }
}
