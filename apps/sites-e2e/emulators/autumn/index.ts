import { EmulatorError, startEmulator } from "../core/service";
import type { AutumnEmulatorOptions } from "./types";

// Autumn's customer API, enough for the Sites plan check: a customer gets the
// free plan on first sight (as Autumn's auto-enabled default plan does) and
// keeps whatever plan the test attaches with setPlan.
export async function startAutumnEmulator(options: AutumnEmulatorOptions) {
  const plans = new Map<string, string>();
  const createdAt = new Map<string, number>();
  const server = await startEmulator("autumn", [
    {
      method: "POST",
      path: "/v1/customers.get_or_create",
      handle: async (request) => {
        if (
          request.headers.get("authorization") !== `Bearer ${options.secretKey}`
        ) {
          throw new EmulatorError(401, "Invalid secret key");
        }
        const body = (await request.json()) as { customer_id?: string };
        const customerId = body.customer_id;
        if (!customerId) {
          throw new EmulatorError(400, "customer_id is required");
        }
        const now = Date.now();
        if (!plans.has(customerId)) {
          plans.set(customerId, "free");
        }
        if (!createdAt.has(customerId)) {
          createdAt.set(customerId, now);
        }
        const planId = plans.get(customerId) ?? "free";
        const startedAt = createdAt.get(customerId) ?? now;
        return Response.json({
          id: customerId,
          name: null,
          email: null,
          created_at: startedAt,
          fingerprint: null,
          stripe_id: null,
          env: "sandbox",
          metadata: {},
          send_email_receipts: false,
          billing_controls: {},
          subscriptions: [
            {
              id: `sub_${customerId}`,
              plan_id: planId,
              auto_enable: planId === "free",
              add_on: false,
              status: "active",
              past_due: false,
              canceled_at: null,
              expires_at: null,
              trial_ends_at: null,
              started_at: startedAt,
              current_period_start: null,
              current_period_end: null,
              quantity: 1,
            },
          ],
          purchases: [],
          licenses: [],
          balances: {},
          flags: {},
        });
      },
    },
  ]);
  return {
    ...server,
    plans,
    env: {
      AUTUMN_SECRET_KEY: options.secretKey,
      AUTUMN_API_URL: server.url,
    },
    /** Attaches a plan, as a checkout or a downgrade would. */
    setPlan: (customerId: string, planId: string) => {
      plans.set(customerId, planId);
    },
  };
}
