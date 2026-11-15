import { FEATURES, PAID_OR_LEGACY_PLAN_IDS } from "@notra/ai/billing/features";
import { Autumn } from "autumn-js";
import { Cache, Context, Effect, Layer } from "effect";

import { AI_CREDITS_FEATURE_ID } from "../constants/billing";
import { GeoBillingError, SubscriptionBillingError } from "../errors/billing";
import type {
  GeoEntitlementCheckInput,
  SubscriptionAccessInput,
} from "../types/billing";
import { makeBillingAccessCache } from "./billing-access-cache";

export interface BillingOperations {
  readonly checkSubscriptionAccess: (
    input: SubscriptionAccessInput
  ) => Effect.Effect<boolean, SubscriptionBillingError>;
  readonly checkGeoEntitlement: (
    input: GeoEntitlementCheckInput
  ) => Effect.Effect<boolean, GeoBillingError>;
}

export class BillingService extends Context.Service<
  BillingService,
  BillingOperations
>()("api/Billing") {}

function billingLayer(secretKey: string) {
  const autumn = new Autumn({ secretKey });
  let geoEntitlements:
    | Cache.Cache<string, boolean, GeoBillingError>
    | undefined;
  let subscriptionAccess:
    | Cache.Cache<string, boolean, SubscriptionBillingError>
    | undefined;

  const lookupSubscriptionAccess = Effect.fnUntraced(function* (
    organizationId: string
  ) {
    const customer = yield* Effect.tryPromise({
      try: () => autumn.customers.getOrCreate({ customerId: organizationId }),
      catch: (cause) => new SubscriptionBillingError({ cause }),
    });

    const hasPaidPlan = customer.subscriptions.some(
      (subscription) =>
        !subscription.addOn &&
        subscription.status === "active" &&
        PAID_OR_LEGACY_PLAN_IDS.has(subscription.planId)
    );

    if (hasPaidPlan) {
      return true;
    }

    return yield* Effect.tryPromise({
      try: async () => {
        const check = await autumn.check({
          customerId: organizationId,
          featureId: AI_CREDITS_FEATURE_ID,
          requiredBalance: 1,
        });
        return check.allowed === true;
      },
      catch: (cause) => new SubscriptionBillingError({ cause }),
    });
  });

  return Layer.succeed(
    BillingService,
    BillingService.of({
      checkSubscriptionAccess: Effect.fn("Billing.checkSubscriptionAccess")(
        function* (input: SubscriptionAccessInput) {
          subscriptionAccess ??= Effect.runSync(
            makeBillingAccessCache(lookupSubscriptionAccess)
          );
          return yield* Cache.get(subscriptionAccess, input.organizationId);
        }
      ),
      checkGeoEntitlement: Effect.fn("Billing.checkGeoEntitlement")(function* (
        input: GeoEntitlementCheckInput
      ) {
        geoEntitlements ??= Effect.runSync(
          makeBillingAccessCache((organizationId) =>
            Effect.tryPromise({
              try: async () => {
                const data = await autumn.check({
                  customerId: organizationId,
                  featureId: FEATURES.AI_ANSWERS,
                });
                return data.balance != null;
              },
              catch: (cause) => new GeoBillingError({ cause }),
            })
          )
        );
        return yield* Cache.get(geoEntitlements, input.organizationId);
      }),
    })
  );
}

let sharedBillingLayer:
  | { secretKey: string; layer: ReturnType<typeof billingLayer> }
  | undefined;

export function getBillingLayer(secretKey: string) {
  if (sharedBillingLayer?.secretKey !== secretKey) {
    sharedBillingLayer = { secretKey, layer: billingLayer(secretKey) };
  }
  return sharedBillingLayer.layer;
}
