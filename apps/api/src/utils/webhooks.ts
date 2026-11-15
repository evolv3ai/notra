import { members } from "@notra/db/schema";
import {
  WebhookNotFound,
  WebhookValidationError,
} from "@notra/webhooks/errors/webhooks";
import { OrganizationId } from "@notra/webhooks/schemas/webhooks";
import type { WebhookDatabase } from "@notra/webhooks/services/database";
import { and, eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Config, ManagedRuntime } from "effect";
import type { Context, Next } from "hono";

import { isAccountKeyAuth, isOAuthAuth } from "../types/auth";
import type { ApiEnv } from "../types/env";
import { getOrganizationId } from "./auth";
import { logError } from "./logging";

export function runWebhookApi<A, E extends { readonly _tag: string }>(
  runtime: ManagedRuntime.ManagedRuntime<WebhookDatabase, Config.ConfigError>,
  c: Context<ApiEnv>,
  program: Effect.Effect<A, E, WebhookDatabase>
) {
  return runtime.runPromise(
    program.pipe(
      Effect.catchIf(Schema.is(WebhookNotFound), () =>
        Effect.succeed(c.json({ error: "Webhook not found" }, 404))
      ),
      Effect.catchIf(Schema.is(WebhookValidationError), (error) =>
        Effect.succeed(c.json({ error: error.message }, 400))
      ),
      Effect.catch((error) =>
        Effect.sync(() => {
          logError(`Webhook request failed (${error._tag})`, error);
          return c.json({ error: "Webhooks unavailable" }, 503);
        })
      )
    )
  );
}

export const decodeOrganizationId = (c: Context<ApiEnv>) =>
  Schema.decodeUnknownEffect(OrganizationId)(getOrganizationId(c)).pipe(
    Effect.mapError(
      () =>
        new WebhookValidationError({
          message:
            "The authenticated credential is not tied to an organization",
        })
    )
  );

/**
 * Mirrors the dashboard rule that only owners and admins mutate webhooks.
 * User-bound credentials (account keys, OAuth) are checked against the user's
 * current role; organization keys are gated when the key is issued.
 */
export async function requireWebhookManager(c: Context<ApiEnv>, next: Next) {
  const auth = c.get("auth");
  if (
    c.req.method === "GET" ||
    c.req.method === "HEAD" ||
    !(auth && (isAccountKeyAuth(auth) || isOAuthAuth(auth)))
  ) {
    return await next();
  }

  const organizationId = getOrganizationId(c);
  const membership = organizationId
    ? await c.get("db").query.members.findFirst({
        where: and(
          eq(members.userId, auth.userId),
          eq(members.organizationId, organizationId)
        ),
        columns: { role: true },
      })
    : undefined;
  if (membership?.role === "owner" || membership?.role === "admin") {
    return await next();
  }

  return c.json(
    { error: "Only organization owners and admins can manage webhooks" },
    403
  );
}
