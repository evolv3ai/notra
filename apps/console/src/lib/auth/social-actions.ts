"use server";

import { redis } from "@notra/ai/utils/redis";
import { startSocialSignInInputSchema } from "@notra/schemas/dashboard/auth/social";
import type { StartSocialSignInInput } from "@notra/schemas/types/dashboard/auth";
import { sanitizeReturnTo } from "@notra/utils/auth-redirect";
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  CONSOLE_AUTH_TTL_SECONDS,
  CONSOLE_SOCIAL_COOKIE,
  CONSOLE_SOCIAL_CALLBACK_PATH,
  CONSOLE_SOCIAL_PROVIDERS,
} from "@/constants/auth";
import { consoleAppUrl, limitConsoleSignIn } from "@/lib/auth/flow";
import type { ConsoleSocialAttempt } from "@/types/auth";

export async function startSocialSignInAction(
  rawInput: StartSocialSignInInput
): Promise<void> {
  const parsed = startSocialSignInInputSchema.safeParse(rawInput);
  if (!parsed.success || !redis) {
    throw new Error("Social sign-in is unavailable");
  }
  await limitConsoleSignIn();
  const pkce = await getWorkOS().pkce.generate();
  const nonce = crypto.randomUUID();
  const attempt: ConsoleSocialAttempt = {
    codeVerifier: pkce.codeVerifier,
    returnTo: sanitizeReturnTo(parsed.data.returnTo ?? null),
  };
  await redis.set(`console:social:${nonce}`, attempt, {
    ex: CONSOLE_AUTH_TTL_SECONDS,
  });
  (await cookies()).set(CONSOLE_SOCIAL_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: consoleAppUrl().startsWith("https://"),
    path: "/",
    maxAge: CONSOLE_AUTH_TTL_SECONDS,
  });
  const url = getWorkOS().userManagement.getAuthorizationUrl({
    clientId: process.env.WORKOS_CLIENT_ID ?? "",
    provider: CONSOLE_SOCIAL_PROVIDERS[parsed.data.provider],
    redirectUri: new URL(CONSOLE_SOCIAL_CALLBACK_PATH, consoleAppUrl()).href,
    state: nonce,
    codeChallenge: pkce.codeChallenge,
    codeChallengeMethod: "S256",
  });
  redirect(url);
}
