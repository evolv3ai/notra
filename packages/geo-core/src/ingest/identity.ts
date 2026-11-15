import { getGeoIngestTokenGeneration } from "@notra/geo-core/geo/ingest";
import type { GeoIngestIdentity } from "@notra/geo-core/types/geo";
import { Effect } from "effect";

import { GeoIngestFailedError, GeoIngestInvalidTokenError } from "./errors";

/**
 * A valid signature is not enough: the token's generation must match the
 * token's organization or project scope (rotation revokes older generations), and the
 * organization (and project, when the token is project-scoped) must still
 * exist so leaked tokens die with the resources they were minted for. The
 * generation lookup also checks existence and project ownership. Checks fail
 * closed so a database outage cannot reauthorize a revoked token.
 */
export const assertGeoIngestIdentityActive = Effect.fn(
  "geoIngest.checkIdentity"
)(function* (identity: GeoIngestIdentity) {
  const context = {
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    siteId: identity.site?.id,
  };
  const generation = yield* Effect.tryPromise({
    try: () =>
      getGeoIngestTokenGeneration(identity.organizationId, identity.projectId),
    catch: (cause) =>
      new GeoIngestFailedError({
        ...context,
        cause,
        stage: "identity_lookup",
      }),
  });
  if (generation === null) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({
        ...context,
        authReason: "identity_missing",
      })
    );
  }
  if (!identity.site && generation !== identity.generation) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({
        ...context,
        authReason: "token_revoked",
      })
    );
  }
});
