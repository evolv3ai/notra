import { redis } from "@notra/ai/utils/redis";
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CONSOLE_SOCIAL_COOKIE } from "@/constants/auth";
import { rememberPendingAuth, runConsoleAuth } from "@/lib/auth/flow";
import type { ConsoleSocialAttempt } from "@/types/auth";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get(CONSOLE_SOCIAL_COOKIE)?.value;
  cookieStore.delete(CONSOLE_SOCIAL_COOKIE);
  if (!(state && expected && state === expected && redis)) {
    redirect("/login?error=social-sign-in-failed");
  }
  const attempt = await redis.getdel<ConsoleSocialAttempt>(
    `console:social:${state}`
  );
  const code = params.get("code");
  if (!(attempt && code)) {
    redirect("/login?error=social-sign-in-failed");
  }
  const result = await runConsoleAuth(
    () =>
      getWorkOS().userManagement.authenticateWithCode({
        clientId: process.env.WORKOS_CLIENT_ID ?? "",
        code,
        codeVerifier: attempt.codeVerifier,
      }),
    "",
    attempt.returnTo
  );
  if (result.status === "success") {
    redirect(result.redirectTo);
  }
  if (result.status === "error" || result.status === "enrolled") {
    redirect("/login?error=social-sign-in-failed");
  }
  await rememberPendingAuth(result);
  redirect(
    `/login${attempt.returnTo ? `?returnTo=${encodeURIComponent(attempt.returnTo)}` : ""}`
  );
}
