import { Effect, Schema } from "effect";

import { MAX_ENDPOINTS_PER_ORGANIZATION } from "../constants/delivery";
import { WebhookNotFound, WebhookValidationError } from "../errors/webhooks";
import { Endpoint, EndpointInput, IdentifierRow } from "../schemas/webhooks";
import { WebhookCrypto } from "../services/crypto";
import { decodeRows, queryRows, WebhookDatabase } from "../services/database";
import type { EndpointId, OrganizationId } from "../types/webhooks";
import { isoTimestamp } from "../utils/sql";
import { validateEndpointUrl } from "../utils/url";

const ENDPOINT_COLUMNS = `id, organization_id AS "organizationId", url, events, enabled, ${isoTimestamp("created_at")} AS "createdAt"`;

export const createEndpoint = Effect.fn("webhooks.createEndpoint")(function* (
  input: unknown
) {
  const body = yield* Schema.decodeUnknownEffect(EndpointInput)(input).pipe(
    Effect.mapError(
      () =>
        new WebhookValidationError({ message: "Invalid webhook subscription" })
    )
  );
  const url = yield* validateEndpointUrl(body.url);
  const cryptography = yield* WebhookCrypto;
  const id = yield* Effect.sync(() => `whe_${crypto.randomUUID()}`);
  const secret = yield* cryptography.createSecret();
  const encrypted = yield* cryptography.encrypt(secret, id);
  const database = yield* WebhookDatabase;
  // The lock makes concurrent creates for one organization wait, so the count
  // (a fresh snapshot per statement) can't let both past the limit.
  const [, inserted] = yield* database.transaction([
    {
      sql: "SELECT pg_advisory_xact_lock(hashtext('webhook_endpoints:' || $1))",
      parameters: [body.organizationId],
    },
    {
      sql: `INSERT INTO webhook_endpoints (id, organization_id, url, events, secret)
    SELECT $1::text, $2::text, $3::text, $4::text[], $5::text
    WHERE (SELECT count(*) FROM webhook_endpoints WHERE organization_id = $2 AND deleted_at IS NULL) < $6
    RETURNING ${ENDPOINT_COLUMNS}`,
      parameters: [
        id,
        body.organizationId,
        url,
        [...new Set(body.events)],
        encrypted,
        MAX_ENDPOINTS_PER_ORGANIZATION,
      ],
    },
  ]);
  const [endpoint] = yield* decodeRows(Endpoint, inserted);
  if (!endpoint) {
    return yield* new WebhookValidationError({
      message: `An organization can have at most ${MAX_ENDPOINTS_PER_ORGANIZATION} webhook subscriptions`,
    });
  }
  return { endpoint, secret };
});

export const listEndpoints = Effect.fn("webhooks.listEndpoints")(function* (
  organizationId: OrganizationId
) {
  return yield* queryRows(
    Endpoint,
    `SELECT ${ENDPOINT_COLUMNS}
    FROM webhook_endpoints WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC`,
    [organizationId]
  );
});

export const deleteEndpoint = Effect.fn("webhooks.deleteEndpoint")(function* (
  organizationId: OrganizationId,
  endpointId: EndpointId
) {
  const [deleted] = yield* queryRows(
    IdentifierRow,
    `WITH endpoint AS (
    UPDATE webhook_endpoints SET enabled = false, deleted_at = now() WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING id
  ), cancelled AS (
    UPDATE webhook_deliveries SET status = 'cancelled', updated_at = now()
    WHERE organization_id = $1 AND endpoint_id IN (SELECT id FROM endpoint) AND status IN ('pending', 'retrying')
  ) SELECT id FROM endpoint`,
    [organizationId, endpointId]
  );
  if (!deleted) {
    return yield* new WebhookNotFound({ resource: "endpoint" });
  }
  return deleted;
});
