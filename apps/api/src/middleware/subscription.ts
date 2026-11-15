import { shouldBypassAutumnInDevelopment } from "@notra/ai/utils/autumn-development";
import { logError } from "@notra/ai/utils/server-log";
import { Effect } from "effect";
import type { Context, Next } from "hono";

import { API_PAYWALL_FEATURES } from "../constants/analytics";
import { RESTRICTED_BILLING_METHODS } from "../constants/billing";
import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import { BillingService, getBillingLayer } from "../lib/billing";
import { isIngestAuth } from "../types/auth";
import { trackApiPaywalled } from "../utils/analytics";
import { getOrganizationId } from "../utils/auth";

export function subscriptionMiddleware() {
  return async (c: Context, next: Next) => {
    if (!RESTRICTED_BILLING_METHODS.has(c.req.method)) {
      return next();
    }

    if (isIngestAuth(c.get("auth"))) {
      return next();
    }

    const secretKey = c.env.AUTUMN_SECRET_KEY as string | undefined;
    if (!secretKey) {
      if (shouldBypassAutumnInDevelopment(process.env.NODE_ENV, secretKey)) {
        return next();
      }

      logError("AUTUMN_SECRET_KEY is not configured, rejecting write request");
      trackApiPaywalled(c, {
        feature: API_PAYWALL_FEATURES.SUBSCRIPTION,
        status: 503,
      });
      return c.json({ error: "Billing service unavailable" }, 503);
    }

    const orgId = getOrganizationId(c);
    if (!orgId) {
      return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
    }

    const access = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          const billing = yield* BillingService;
          return yield* billing.checkSubscriptionAccess({
            organizationId: orgId,
          });
        }).pipe(
          Effect.withSpan("billing.checkSubscriptionAccess"),
          Effect.provide(getBillingLayer(secretKey))
        )
      )
    );

    if (access._tag === "Failure") {
      return c.json({ error: "Failed to verify subscription status" }, 500);
    }

    if (!access.success) {
      trackApiPaywalled(c, {
        feature: API_PAYWALL_FEATURES.SUBSCRIPTION,
        status: 402,
      });
      return c.json({ error: "Active subscription required" }, 402);
    }

    return next();
  };
}
