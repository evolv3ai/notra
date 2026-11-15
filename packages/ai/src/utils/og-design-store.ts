import { calculateTokenCostUsd } from "@notra/ai/billing/token-pricing";
import {
  OG_DESIGN_FAILURE_TTL_MS,
  OG_DESIGN_LEASE_MS,
  OG_TEMPLATE_MAX_AGE_MS,
  OG_COST_LOOKUP_TIMEOUT_MS,
  OG_DESIGN_RECOVERY_MS,
} from "@notra/ai/constants/og-image";
import { enrichRouteMetadata } from "@notra/ai/gateway";
import { OgPersistenceError } from "@notra/ai/schemas/og-errors";
import {
  ogCallRouteSchema,
  savedOgTemplateSchema,
} from "@notra/ai/schemas/og-image";
import type { OgDesignClaim, OgDesignCall } from "@notra/ai/types/og-image";
import { db } from "@notra/db/drizzle";
import {
  brandOgDesignRuns,
  brandOgDesignCalls,
  brandOgTemplates,
} from "@notra/db/schema";
import type { OgDesignRunStatus } from "@notra/db/types/og-image";
import { advisoryXactLock } from "@notra/db/utils/advisory-xact-lock";
import { and, desc, eq, gt, lte, sql, isNull, asc, inArray } from "drizzle-orm";
import { Effect } from "effect";

export const claimOgDesign = Effect.fn("OgDesign.claim")(function* (
  organizationId: string,
  brandId: string,
  sourceHash: string
) {
  return yield* Effect.tryPromise({
    try: () =>
      db.transaction(async (tx): Promise<OgDesignClaim> => {
        const acquired = await advisoryXactLock(tx, brandId, { try: true });
        if (!acquired) {
          return {
            kind: "unavailable",
            reason: "A brand design is already being claimed",
          };
        }
        const latest = await tx.query.brandOgTemplates.findFirst({
          where: eq(brandOgTemplates.brandSettingsId, brandId),
        });
        const parsed = savedOgTemplateSchema.safeParse(latest?.document);
        if (
          parsed.success &&
          latest?.sourceHash === sourceHash &&
          Date.now() - latest.updatedAt.getTime() < OG_TEMPLATE_MAX_AGE_MS
        ) {
          return { kind: "cached", document: parsed.data };
        }
        // A crashed worker's running entry becomes a durable failure, not a free retry.
        const expired = await tx
          .update(brandOgDesignRuns)
          .set({
            status: "abandoned",
            finishedAt: sql`now()`,
            retryAfter: sql`case when exists (select 1 from ${brandOgDesignCalls} where ${brandOgDesignCalls.runId} = ${brandOgDesignRuns.id}) then now() + ${OG_DESIGN_RECOVERY_MS} * interval '1 millisecond' else null end`,
            error:
              "Design lease expired before completion; provider costs may be incomplete",
          })
          .where(
            and(
              eq(brandOgDesignRuns.brandSettingsId, brandId),
              eq(brandOgDesignRuns.status, "running"),
              lte(brandOgDesignRuns.leaseExpiresAt, sql`now()`)
            )
          )
          .returning({ id: brandOgDesignRuns.id });
        if (expired.length) {
          await tx
            .update(brandOgDesignCalls)
            .set({
              status: "aborted",
              finishedAt: sql`now()`,
              error: "Owner lease expired; provider outcome unknown",
            })
            .where(
              and(
                inArray(
                  brandOgDesignCalls.runId,
                  expired.map((run) => run.id)
                ),
                eq(brandOgDesignCalls.status, "running")
              )
            );
        }
        const active = await tx.query.brandOgDesignRuns.findFirst({
          where: and(
            eq(brandOgDesignRuns.brandSettingsId, brandId),
            eq(brandOgDesignRuns.status, "running")
          ),
        });
        if (active) {
          return {
            kind: "unavailable",
            reason: "A brand template is already being designed; retry later",
          };
        }
        const failed = await tx.query.brandOgDesignRuns.findFirst({
          where: and(
            eq(brandOgDesignRuns.brandSettingsId, brandId),
            eq(brandOgDesignRuns.sourceHash, sourceHash),
            gt(brandOgDesignRuns.retryAfter, sql`now()`)
          ),
          orderBy: [desc(brandOgDesignRuns.createdAt)],
        });
        if (failed) {
          return {
            kind: "unavailable",
            reason:
              "Brand design is temporarily backed off after a failed attempt",
          };
        }
        const runId = crypto.randomUUID();
        await tx.insert(brandOgDesignRuns).values({
          id: runId,
          organizationId,
          brandSettingsId: brandId,
          sourceHash,
          leaseExpiresAt: sql`now() + ${OG_DESIGN_LEASE_MS} * interval '1 millisecond'`,
        });
        return { kind: "lease", runId };
      }),
    catch: (cause) => new OgPersistenceError({ operation: "claim", cause }),
  });
});

export async function recordOgDesignCall(runId: string, call: OgDesignCall) {
  const usage = call.usage;
  const values = {
    status: call.status,
    usage: usage ?? null,
    route: usage?.route ?? null,
    estimatedCostUsd: usage
      ? calculateTokenCostUsd(
          usage,
          usage.modelId ?? call.requestedModel,
          usage.route?.gateway
        )
      : null,
    reportedCostUsd:
      usage?.route?.costSource === "reported"
        ? (usage.route.costUsd ?? null)
        : null,
    error: call.error ?? null,
    finishedAt: call.status === "running" ? null : new Date(),
  };
  if (call.status === "running") {
    await db.transaction(async (tx) => {
      const owned = await tx
        .update(brandOgDesignRuns)
        .set({ status: "running" })
        .where(
          and(
            eq(brandOgDesignRuns.id, runId),
            eq(brandOgDesignRuns.status, "running"),
            gt(brandOgDesignRuns.leaseExpiresAt, sql`now()`)
          )
        )
        .returning({ id: brandOgDesignRuns.id });
      if (!owned.length) {
        throw new Error("Design lease no longer owned");
      }
      await tx.insert(brandOgDesignCalls).values({
        id: call.id,
        runId,
        stage: call.stage,
        requestedModel: call.requestedModel,
      });
    });
  } else {
    await db
      .update(brandOgDesignCalls)
      .set(values)
      .where(
        and(
          eq(brandOgDesignCalls.id, call.id),
          eq(brandOgDesignCalls.runId, runId)
        )
      );
  }
}

export const finishOgDesign = Effect.fn("OgDesign.finish")(function* (
  runId: string,
  status: OgDesignRunStatus,
  error?: string,
  retryMs = OG_DESIGN_FAILURE_TTL_MS
) {
  yield* Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        await tx
          .update(brandOgDesignRuns)
          .set({
            status,
            error: error?.slice(0, 1000),
            finishedAt: sql`now()`,
            retryAfter:
              status !== "succeeded"
                ? sql`case when exists (select 1 from ${brandOgDesignCalls} where ${brandOgDesignCalls.runId} = ${brandOgDesignRuns.id}) then now() + ${retryMs} * interval '1 millisecond' else null end`
                : null,
          })
          .where(
            and(
              eq(brandOgDesignRuns.id, runId),
              eq(brandOgDesignRuns.status, "running")
            )
          );
        await tx
          .update(brandOgDesignCalls)
          .set({
            status: "aborted",
            finishedAt: sql`now()`,
            error:
              "Design ended before call completion was persisted; provider outcome unknown",
          })
          .where(
            and(
              eq(brandOgDesignCalls.runId, runId),
              eq(brandOgDesignCalls.status, "running")
            )
          );
      }),
    catch: (cause) => new OgPersistenceError({ operation: "finish", cause }),
  });
});

/** Reusable read-only-provider reconciliation; missing IDs remain explicitly unmeasured. */
export const reconcileOgDesignCosts = Effect.fn("OgDesign.reconcileCosts")(
  function* (organizationId: string, runId: string) {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ call: brandOgDesignCalls })
          .from(brandOgDesignCalls)
          .innerJoin(
            brandOgDesignRuns,
            eq(brandOgDesignCalls.runId, brandOgDesignRuns.id)
          )
          .where(
            and(
              eq(brandOgDesignRuns.id, runId),
              eq(brandOgDesignRuns.organizationId, organizationId)
            )
          ),
      catch: (cause) =>
        new OgPersistenceError({ operation: "readCosts", cause }),
    });
    yield* Effect.forEach(
      rows,
      ({ call }) =>
        Effect.tryPromise({
          try: async (signal) => {
            if (call.reportedCostUsd !== null) {
              return;
            }
            // Use the same DB clock as the sweep, including invalid/unavailable routes.
            await db
              .update(brandOgDesignCalls)
              .set({ costCheckedAt: sql`now()` })
              .where(eq(brandOgDesignCalls.id, call.id));
            const parsed = ogCallRouteSchema.safeParse(call.route);
            if (!parsed.success || !parsed.data.generationId) {
              return;
            }
            const enriched = await enrichRouteMetadata(
              parsed.data,
              AbortSignal.any([
                signal,
                AbortSignal.timeout(OG_COST_LOOKUP_TIMEOUT_MS),
              ])
            );
            if (
              enriched.costSource !== "reported" ||
              enriched.costUsd === undefined
            ) {
              return;
            }
            await db
              .update(brandOgDesignCalls)
              .set({ reportedCostUsd: enriched.costUsd })
              .where(eq(brandOgDesignCalls.id, call.id));
          },
          catch: (cause) =>
            new OgPersistenceError({ operation: "reconcileCosts", cause }),
        }),
      { concurrency: 4, discard: true }
    );
  }
);

/** The authenticated monitoring cron retries delayed gateway ingestion, not generation. */
export const sweepOgDesignCosts = Effect.fn("OgDesign.sweepCosts")(
  function* () {
    const runs = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            runId: brandOgDesignRuns.id,
            organizationId: brandOgDesignRuns.organizationId,
          })
          .from(brandOgDesignCalls)
          .innerJoin(
            brandOgDesignRuns,
            eq(brandOgDesignCalls.runId, brandOgDesignRuns.id)
          )
          .where(
            and(
              isNull(brandOgDesignCalls.reportedCostUsd),
              sql`${brandOgDesignCalls.route}->>'generationId' is not null`,
              sql`${brandOgDesignCalls.createdAt} < now() - interval '1 minute'`,
              sql`${brandOgDesignCalls.createdAt} > now() - interval '7 days'`,
              sql`(${brandOgDesignCalls.costCheckedAt} is null or ${brandOgDesignCalls.costCheckedAt} < now() - interval '1 hour')`
            )
          )
          .groupBy(brandOgDesignRuns.id, brandOgDesignRuns.organizationId)
          .orderBy(
            asc(
              sql`min(coalesce(${brandOgDesignCalls.costCheckedAt}, ${brandOgDesignCalls.createdAt}))`
            )
          )
          .limit(8),
      catch: (cause) =>
        new OgPersistenceError({ operation: "pendingCosts", cause }),
    });
    yield* Effect.forEach(
      runs,
      (run) => reconcileOgDesignCosts(run.organizationId, run.runId),
      { concurrency: 2, discard: true }
    );
    return { runs: runs.length };
  }
);
