import { autumnHandler } from "autumn-js/fetch";

import { getAuthSession } from "@/lib/auth/server";
import { prepareAutumnRequest } from "@/lib/billing/autumn-request";
import { resolveBillingOrganizationId } from "@/lib/billing/resolve-billing-organization";
import { createDevelopmentAutumnHandler } from "@/utils/development-autumn";

type RouteHandler = (request: Request) => Response | Promise<Response>;

async function resolveCustomerId(request: Request) {
  const session = await getAuthSession();
  if (!session?.user) {
    return null;
  }
  return resolveBillingOrganizationId(request, session);
}

const developmentHandler = createDevelopmentAutumnHandler(
  process.env.NODE_ENV,
  process.env.AUTUMN_SECRET_KEY,
  resolveCustomerId
);

const autumnRouteHandler = autumnHandler({
  identify: async (request) => {
    const session = await getAuthSession();

    if (!session?.user) {
      return null;
    }

    const customerId = await resolveBillingOrganizationId(request, session);

    if (!customerId) {
      return null;
    }

    return {
      customerId,
      customerData: {
        name: session.user.name,
        email: session.user.email,
      },
    };
  },
});

const handler: RouteHandler =
  developmentHandler ??
  (async (request) => {
    const prepared = await prepareAutumnRequest(request, () =>
      resolveCustomerId(request)
    );
    return prepared instanceof Response
      ? prepared
      : autumnRouteHandler(prepared);
  });

export const GET = handler;
export const POST = handler;
