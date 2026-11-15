import { AUTUMN_READ_ROUTES } from "@/constants/billing";
import { DUB_CUSTOMER_EXTERNAL_ID_METADATA_KEY } from "@/constants/dub";
import {
  autumnAttachBodySchema,
  autumnMultiAttachBodySchema,
  autumnOpenCustomerPortalBodySchema,
  autumnUpdateSubscriptionBodySchema,
} from "@/schemas/billing-checkout";

type SanitizedBody =
  | { kind: "ok"; body: unknown }
  | { kind: "invalid" }
  | { kind: "unknown" };

function errorResponse(statusCode: number, code: string, message: string) {
  return Response.json({ code, message, statusCode }, { status: statusCode });
}

function dubMetadata(customerId: string | null) {
  return customerId
    ? { [DUB_CUSTOMER_EXTERNAL_ID_METADATA_KEY]: customerId }
    : {};
}

function sanitizeBody(
  route: string,
  raw: unknown,
  customerId: string | null
): SanitizedBody {
  switch (route) {
    case "attach": {
      const parsed = autumnAttachBodySchema.safeParse(raw);
      if (!parsed.success) {
        return { kind: "invalid" };
      }
      return {
        kind: "ok",
        body: {
          ...parsed.data,
          metadata: { ...parsed.data.metadata, ...dubMetadata(customerId) },
        },
      };
    }
    case "multiAttach": {
      const parsed = autumnMultiAttachBodySchema.safeParse(raw);
      if (!parsed.success) {
        return { kind: "invalid" };
      }
      const session = parsed.data.checkoutSessionParams;
      return {
        kind: "ok",
        body: {
          ...parsed.data,
          checkoutSessionParams: {
            ...session,
            metadata: { ...session?.metadata, ...dubMetadata(customerId) },
          },
        },
      };
    }
    case "updateSubscription": {
      const parsed = autumnUpdateSubscriptionBodySchema.safeParse(raw);
      return parsed.success
        ? { kind: "ok", body: parsed.data }
        : { kind: "invalid" };
    }
    case "openCustomerPortal": {
      const parsed = autumnOpenCustomerPortalBodySchema.safeParse(raw);
      return parsed.success
        ? { kind: "ok", body: parsed.data }
        : { kind: "invalid" };
    }
    default:
      return { kind: "unknown" };
  }
}

// autumn-js forwards the browser body to Autumn with the secret key and only
// strips customer identity fields, so mutations are rebuilt from the fields
// the dashboard actually sends and unused routes are refused.
export async function prepareAutumnRequest(
  request: Request,
  resolveCustomerId: () => Promise<string | null>
): Promise<Request | Response> {
  if (request.method !== "POST") {
    return request;
  }

  const route = new URL(request.url).pathname.split("/").at(-1) ?? "";
  if (AUTUMN_READ_ROUTES.has(route)) {
    return request;
  }

  const raw = await request
    .clone()
    .json()
    .catch(() => null);
  const result = sanitizeBody(route, raw, await resolveCustomerId());
  if (result.kind === "unknown") {
    return errorResponse(404, "route_not_allowed", "Billing action not found");
  }
  if (result.kind === "invalid") {
    return errorResponse(400, "invalid_body", "Invalid billing request");
  }

  return new Request(request, {
    method: "POST",
    body: JSON.stringify(result.body),
  });
}
