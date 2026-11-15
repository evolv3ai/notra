import { logWarn } from "@notra/ai/utils/server-log";

import { DEMO_TURNSTILE_ACTION } from "@/constants/turnstile";
import {
  turnstileTokenSchema,
  turnstileVerificationSchema,
} from "@/schemas/turnstile";

export async function verifyDemoHumanCheck(
  token: unknown,
  hostname: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET?.trim();
  const hostnames = (process.env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  if (!secret || !hostnames.includes(hostname)) {
    logWarn("[demo] Human verification is not configured for this hostname", {
      reason: "turnstile_unconfigured",
    });
    return false;
  }

  const parsed = turnstileTokenSchema.safeParse(token);
  if (!parsed.success) {
    logWarn("[demo] Human verification token missing or malformed", {
      reason: "turnstile_invalid_token",
    });
    return false;
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({ secret, response: parsed.data }),
      }
    );
    if (!response.ok) {
      logWarn("[demo] Human verification service unavailable", {
        reason: "turnstile_unavailable",
      });
      return false;
    }
    const result = turnstileVerificationSchema.safeParse(await response.json());
    const verified =
      result.success &&
      result.data.action === DEMO_TURNSTILE_ACTION &&
      result.data.hostname === hostname;
    if (!verified) {
      logWarn("[demo] Human verification rejected", {
        reason: "turnstile_rejected",
      });
    }
    return verified;
  } catch {
    logWarn("[demo] Human verification service unavailable", {
      reason: "turnstile_unavailable",
    });
    return false;
  }
}
