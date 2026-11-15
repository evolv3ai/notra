import { createHash } from "node:crypto";

import { designOgTemplate } from "@notra/ai/agents/og-image";
import {
  OG_TEMPLATE_MAX_AGE_MS,
  OG_DESIGN_REVISION,
  OG_HASH_IGNORED_KEYS,
  OG_DESIGN_FAILURE_TTL_MS,
  OG_DESIGN_RECOVERY_MS,
} from "@notra/ai/constants/og-image";
import {
  OgPersistenceError,
  OgQualityError,
} from "@notra/ai/schemas/og-errors";
import {
  ogImageInputSchema,
  savedOgTemplateSchema,
} from "@notra/ai/schemas/og-image";
import type {
  GenerateOgImageParams,
  OgBrandContext,
  SavedOgTemplate,
} from "@notra/ai/types/og-image";
import { loadOgBrand } from "@notra/ai/utils/og-brand";
import {
  claimOgDesign,
  finishOgDesign,
  recordOgDesignCall,
} from "@notra/ai/utils/og-design-store";
import { fallbackOgTemplate } from "@notra/ai/utils/og-fallback";
import { renderOgImage } from "@notra/ai/utils/og-render";
import { logWarn } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { brandOgTemplates, brandOgDesignRuns } from "@notra/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { Effect, Exit, Schedule } from "effect";

const designWithLease = Effect.fn("OgDesign.generate")(function* (
  brand: OgBrandContext,
  sourceHash: string,
  params: GenerateOgImageParams
) {
  let retryMs = OG_DESIGN_RECOVERY_MS;
  return yield* Effect.acquireUseRelease(
    claimOgDesign(params.organizationId, brand.id, sourceHash),
    (claim) =>
      Effect.gen(function* () {
        if (claim.kind === "cached") {
          return claim.document;
        }
        if (claim.kind === "unavailable") {
          return yield* Effect.fail(
            new OgPersistenceError({ operation: "claim", cause: claim.reason })
          );
        }
        const document = yield* Effect.tryPromise({
          try: (signal) =>
            designOgTemplate(brand, {
              ...params,
              signal,
              onCall: (call) => recordOgDesignCall(claim.runId, call),
            }),
          catch: (cause) => {
            if (cause instanceof OgQualityError) {
              retryMs = OG_DESIGN_FAILURE_TTL_MS;
            }
            return new OgPersistenceError({ operation: "design", cause });
          },
        });
        yield* Effect.tryPromise({
          try: () =>
            db.transaction(async (tx) => {
              const [run] = await tx
                .select()
                .from(brandOgDesignRuns)
                .where(eq(brandOgDesignRuns.id, claim.runId))
                .for("update");
              // An ambiguous COMMIT may already have persisted this exact run.
              if (run?.status === "succeeded") {
                return;
              }
              const owned = await tx
                .update(brandOgDesignRuns)
                .set({ status: "succeeded", finishedAt: sql`now()` })
                .where(
                  and(
                    eq(brandOgDesignRuns.id, claim.runId),
                    eq(brandOgDesignRuns.status, "running"),
                    gt(brandOgDesignRuns.leaseExpiresAt, sql`now()`)
                  )
                )
                .returning({ id: brandOgDesignRuns.id });
              if (!owned.length) {
                throw new Error(
                  "Design lease expired; stale result was not saved"
                );
              }
              await tx
                .insert(brandOgTemplates)
                .values({ brandSettingsId: brand.id, sourceHash, document })
                .onConflictDoUpdate({
                  target: brandOgTemplates.brandSettingsId,
                  set: { sourceHash, document, updatedAt: new Date() },
                });
            }),
          catch: (cause) =>
            new OgPersistenceError({ operation: "save", cause }),
        }).pipe(Effect.retry(Schedule.recurs(1)));
        return document;
      }),
    (claim, exit) =>
      Effect.gen(function* () {
        if (claim.kind !== "lease") {
          return;
        }
        const cancelled = params.signal?.aborted;
        let status: "succeeded" | "cancelled" | "failed" = "failed";
        let error =
          "Design failed; inspect model-call history and operation logs";
        if (Exit.isSuccess(exit)) {
          status = "succeeded";
          error = "";
        } else if (cancelled) {
          status = "cancelled";
          error = "Caller cancelled the design";
        }
        yield* finishOgDesign(claim.runId, status, error, retryMs).pipe(
          Effect.catch((error) =>
            Effect.sync(() =>
              logWarn("[og-image] Could not finalize design lease", {
                runId: claim.runId,
                error: error.operation,
              })
            )
          )
        );
      })
  );
});

export function getOgBrandHash(brand: OgBrandContext) {
  return createHash("sha256")
    .update(
      JSON.stringify([OG_DESIGN_REVISION, brand], (key, value) =>
        OG_HASH_IGNORED_KEYS.has(key) ? undefined : value
      )
    )
    .digest("hex");
}

/** Shared by agent tools and Autopilot. Only approved, self-contained templates persist. */
export async function generateBrandOgImage(params: GenerateOgImageParams) {
  params.signal?.throwIfAborted();
  const input = ogImageInputSchema.parse(params);
  const brand = await loadOgBrand(params.organizationId, input.brandIdentityId);
  const sourceHash = getOgBrandHash(brand);
  const cached = await db.query.brandOgTemplates.findFirst({
    where: eq(brandOgTemplates.brandSettingsId, brand.id),
  });
  const parsed = savedOgTemplateSchema.safeParse(cached?.document);
  const saved = parsed.success ? parsed.data : null;
  const plain = async (reason: string) => {
    const fallback = await fallbackOgTemplate(brand);
    return {
      ...(await renderOgImage(fallback, input.title, brand)),
      brandIdentityId: brand.id,
      templateSource: "fallback" as const,
      warnings: [...fallback.warnings, reason],
    };
  };
  if (
    saved &&
    cached?.sourceHash === sourceHash &&
    Date.now() - cached.updatedAt.getTime() < OG_TEMPLATE_MAX_AGE_MS
  ) {
    try {
      return {
        ...(await renderOgImage(saved, input.title, brand)),
        brandIdentityId: brand.id,
        templateSource: "cached" as const,
        warnings: saved.warnings,
      };
    } catch {
      return plain(
        "The saved template cannot render this title; no paid redesign was attempted."
      );
    }
  }
  try {
    const document = await Effect.runPromise(
      designWithLease(brand, sourceHash, params),
      { signal: params.signal }
    );
    params.signal?.throwIfAborted();
    return {
      ...(await renderOgImage(document, input.title, brand)),
      brandIdentityId: brand.id,
      templateSource: "generated" as const,
      warnings: document.warnings,
    };
  } catch (error) {
    params.signal?.throwIfAborted();
    logWarn("[og-image] Brand template generation failed", {
      brandIdentityId: brand.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    if (saved) {
      try {
        return {
          ...(await renderOgImage(saved, input.title, brand)),
          brandIdentityId: brand.id,
          templateSource: "last-good" as const,
          warnings: [
            ...saved.warnings,
            "Brand refresh failed; using the last working template.",
          ],
        };
      } catch {
        /* A valid old document can still be too small for this title. */
      }
    }
    return plain("No usable brand template is currently available.");
  }
}
