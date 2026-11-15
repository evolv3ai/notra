import { db } from "@notra/db/drizzle";
import { geoAgentReadinessReports, geoScans } from "@notra/db/schema";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { resolveGeoEntitlement } from "@/lib/billing/subscription";
import { toGeoAccessLevel } from "@/utils/geo-access";

const hasRow = (query: () => Promise<unknown[]>) =>
  Effect.tryPromise(query).pipe(Effect.map((rows) => rows.length > 0));

/** True once the workspace has any GEO scan or agent readiness report. */
export const hasGeoData = Effect.fn("geo.access.hasData")(function* (
  organizationId: string
) {
  const [scan, report] = yield* Effect.all(
    [
      hasRow(() =>
        db
          .select({ id: geoScans.id })
          .from(geoScans)
          .where(eq(geoScans.organizationId, organizationId))
          .limit(1)
      ),
      hasRow(() =>
        db
          .select({ id: geoAgentReadinessReports.id })
          .from(geoAgentReadinessReports)
          .where(eq(geoAgentReadinessReports.organizationId, organizationId))
          .limit(1)
      ),
    ],
    { concurrency: "unbounded" }
  );
  return scan || report;
});

/**
 * What the GEO UI may show. Call only after confirming membership. A failed
 * billing or data lookup never hides data: the API still enforces every write.
 */
export const resolveGeoAccessLevel = Effect.fn("geo.access.resolveLevel")(
  function* (organizationId: string, headers?: Headers) {
    const [entitled, hasData] = yield* Effect.all(
      [
        Effect.tryPromise(() =>
          resolveGeoEntitlement(organizationId, headers)
        ).pipe(
          Effect.map((outcome) => outcome !== "denied"),
          Effect.orElseSucceed(() => true)
        ),
        hasGeoData(organizationId).pipe(Effect.orElseSucceed(() => true)),
      ],
      { concurrency: "unbounded" }
    );
    return toGeoAccessLevel(entitled, hasData);
  }
);
