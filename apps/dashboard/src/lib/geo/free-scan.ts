import { autumn } from "@notra/ai/billing/autumn";
import { FEATURES } from "@notra/ai/billing/features";
import { db } from "@notra/db/drizzle";
import { freeScanClaims, geoSettings } from "@notra/db/schema";
import { geoDb } from "@notra/geo-core/geo/effect";
import { GeoScanStartError } from "@notra/geo-core/geo/errors";
import {
  listGeoPrompts,
  startGeoScanScoped,
} from "@notra/geo-core/geo/programs";
import { requireGeoProject } from "@notra/geo-core/geo/projects";
import type { GeoScopeInput } from "@notra/geo-core/types/geo";
import {
  isDefiniteGeoScanHandoffRejection,
  isGeoScanRunning,
} from "@notra/geo-core/utils/geo-scan";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { Effect } from "effect";

import { FREE_SCAN_BALANCE_ID, FREE_SCAN_ENGINE } from "@/constants/free-scan";
import { resolveCompanyDomain } from "@/lib/onboarding/company-domain";
import type { AuthenticatedUser } from "@/types/auth/organization";
import type { FreeScanResult, FreeScanSkipReason } from "@/types/free-scan";

const skipped = (reason: FreeScanSkipReason): FreeScanResult => ({
  started: false,
  reason,
});

const zeroFreeScanBalance = (organizationId: string) =>
  Effect.tryPromise({
    try: async () => {
      await autumn?.balances.update({
        customerId: organizationId,
        featureId: FEATURES.AI_ANSWERS,
        balanceId: FREE_SCAN_BALANCE_ID,
        remaining: 0,
      });
    },
    catch: (cause) => new GeoScanStartError({ cause }),
  });

const deleteFreeScanBalance = (organizationId: string) =>
  Effect.tryPromise({
    try: async () => {
      await autumn?.balances.delete({
        customerId: organizationId,
        featureId: FEATURES.AI_ANSWERS,
        balanceId: FREE_SCAN_BALANCE_ID,
      });
    },
    catch: (cause) => new GeoScanStartError({ cause }),
  });

const releaseFreeScanClaim = (domain: string, organizationId: string) =>
  deleteFreeScanBalance(organizationId).pipe(
    Effect.ignore,
    Effect.andThen(
      geoDb("free scan claim release failed", () =>
        db
          .update(freeScanClaims)
          .set({ claimedAt: null })
          .where(
            and(
              eq(freeScanClaims.domain, domain),
              eq(freeScanClaims.organizationId, organizationId),
              isNull(freeScanClaims.revokedAt)
            )
          )
      )
    ),
    Effect.ignore
  );

const admitFreeScan = Effect.fn("geo.admitFreeScan")(function* (
  input: GeoScopeInput
) {
  const scope = yield* requireGeoProject(input);
  const settings = yield* geoDb("free scan admission lookup failed", () =>
    db.query.geoSettings.findFirst({
      columns: { scanStartedAt: true, lastScanAt: true },
      where: eq(geoSettings.projectId, scope.projectId),
    })
  );
  return isGeoScanRunning(settings?.scanStartedAt, settings?.lastScanAt)
    ? null
    : scope;
});

const runFreeScan = Effect.fn("geo.runFreeScan")(function* (
  input: GeoScopeInput,
  domain: string,
  promptLimit: number
) {
  const autumnClient = autumn;
  if (!autumnClient) {
    return skipped("billing_unavailable");
  }
  const release = releaseFreeScanClaim(domain, input.organizationId);
  const scope = yield* requireGeoProject(input).pipe(
    Effect.tapError(() => release)
  );
  const { organizationId, projectId } = scope;
  const [{ prompts }, settings] = yield* Effect.all(
    [
      listGeoPrompts(scope),
      geoDb("free scan settings lookup failed", () =>
        db.query.geoSettings.findFirst({
          columns: { languages: true },
          where: eq(geoSettings.projectId, projectId),
        })
      ),
    ],
    { concurrency: "unbounded" }
  ).pipe(Effect.tapError(() => release));
  const languageCount = Math.max(1, settings?.languages?.length ?? 1);
  const promptIds = prompts
    .filter((prompt) => prompt.enabled)
    .slice(0, Math.floor(promptLimit / languageCount))
    .map((prompt) => prompt.id);
  if (promptIds.length === 0) {
    yield* release;
    return skipped("no_prompts");
  }

  yield* deleteFreeScanBalance(organizationId).pipe(Effect.ignore);
  yield* Effect.tryPromise({
    try: () =>
      autumnClient.balances.create({
        customerId: organizationId,
        featureId: FEATURES.AI_ANSWERS,
        balanceId: FREE_SCAN_BALANCE_ID,
        includedGrant: promptLimit,
      }),
    catch: (cause) => new GeoScanStartError({ cause }),
  }).pipe(Effect.tapError(() => release));

  const { scanId } = yield* startGeoScanScoped(
    scope,
    promptIds,
    [FREE_SCAN_ENGINE],
    false,
    true
  ).pipe(
    Effect.tapError((error) =>
      error._tag === "GeoScanStartError" &&
      !isDefiniteGeoScanHandoffRejection(error.cause)
        ? Effect.void
        : release
    )
  );
  const result: FreeScanResult = {
    started: true,
    scanId,
    promptCount: promptIds.length,
  };
  return result;
});

export const startFreeGeoScan = Effect.fn("geo.startFreeScan")(function* (
  input: GeoScopeInput,
  user: AuthenticatedUser
) {
  if (!autumn) {
    return skipped("billing_unavailable");
  }
  if (!user.emailVerified) {
    return skipped("email_unverified");
  }
  const resolution = resolveCompanyDomain({ email: user.email });
  if (resolution?.source !== "email") {
    return skipped("no_company_domain");
  }
  const { domain } = resolution;

  const admitted = yield* admitFreeScan(input);
  if (!admitted) {
    return skipped("scan_running");
  }
  const { organizationId } = admitted;
  const [claim] = yield* geoDb("free scan claim failed", () =>
    db
      .insert(freeScanClaims)
      .values({ domain, organizationId, claimedAt: new Date() })
      .onConflictDoUpdate({
        target: freeScanClaims.domain,
        set: { organizationId, claimedAt: sql`now()` },
        setWhere: isNull(freeScanClaims.claimedAt),
      })
      .returning({ promptLimit: freeScanClaims.promptLimit })
  );
  if (!claim) {
    return skipped("already_claimed");
  }
  return yield* runFreeScan(input, domain, claim.promptLimit);
});

export const startAdminFreeGeoScan = Effect.fn("geo.startAdminFreeScan")(
  function* (domain: string) {
    if (!autumn) {
      return skipped("billing_unavailable");
    }
    const target = yield* geoDb("free scan claim lookup failed", () =>
      db.query.freeScanClaims.findFirst({
        columns: { organizationId: true },
        where: eq(freeScanClaims.domain, domain),
      })
    );
    const organizationId = target?.organizationId;
    if (!organizationId) {
      return skipped("no_organization");
    }
    if (!(yield* admitFreeScan({ organizationId }))) {
      return skipped("scan_running");
    }
    const [claim] = yield* geoDb("free scan claim failed", () =>
      db
        .update(freeScanClaims)
        .set({ claimedAt: sql`now()`, revokedAt: null })
        .where(
          and(
            eq(freeScanClaims.domain, domain),
            eq(freeScanClaims.organizationId, organizationId)
          )
        )
        .returning({ promptLimit: freeScanClaims.promptLimit })
    );
    if (!claim) {
      return skipped("no_organization");
    }
    return yield* runFreeScan({ organizationId }, domain, claim.promptLimit);
  }
);

export const revokeFreeScanBalance = Effect.fn("geo.revokeFreeScanBalance")(
  function* (organizationId: string) {
    const unrevoked = and(
      eq(freeScanClaims.organizationId, organizationId),
      isNotNull(freeScanClaims.claimedAt),
      isNull(freeScanClaims.revokedAt)
    );
    const claim = yield* geoDb("free scan claim lookup failed", () =>
      db.query.freeScanClaims.findFirst({
        columns: { domain: true },
        where: unrevoked,
      })
    );
    if (!claim) {
      return;
    }
    yield* zeroFreeScanBalance(organizationId);
    yield* geoDb("free scan claim revoke failed", () =>
      db.update(freeScanClaims).set({ revokedAt: new Date() }).where(unrevoked)
    );
  }
);
