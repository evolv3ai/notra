import { db } from "@notra/db/drizzle";
import { geoMentionChecks, geoPromptSuggestions } from "@notra/db/schema";
import { listGeoPrompts } from "@notra/geo-core/geo/programs";
import { trackedPromptScanId } from "@notra/geo-core/geo/prompts";
import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  inArray,
  isNull,
  max,
  sql,
} from "drizzle-orm";
import { Effect } from "effect";

import {
  AUTOPILOT_PROMPT_DEAD_MIN_ANSWERS,
  AUTOPILOT_PROMPT_DEAD_MIN_SCANS,
  AUTOPILOT_PROMPT_LOOKBACK_DAYS,
  AUTOPILOT_PROMPT_MAX_SUGGESTIONS,
} from "@/constants/autopilot";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import type {
  AutopilotJobResult,
  AutopilotRunContext,
} from "@/types/autopilot";

/** Answers per prompt over the lookback, from plain scans (no personas or sequences). */
function loadPromptStats(projectId: string, since: Date) {
  return db
    .select({
      promptId: geoMentionChecks.promptId,
      answers: count(),
      scans: countDistinct(geoMentionChecks.scanId),
      mentioned:
        sql<number>`count(*) filter (where ${geoMentionChecks.mentioned})`.mapWith(
          Number
        ),
      withCompetitors:
        sql<number>`count(*) filter (where cardinality(${geoMentionChecks.competitors}) > 0)`.mapWith(
          Number
        ),
      lastCheckedAt: max(geoMentionChecks.capturedAt),
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, projectId),
        gte(geoMentionChecks.capturedAt, since),
        isNull(geoMentionChecks.personaId),
        isNull(geoMentionChecks.sequenceId)
      )
    )
    .groupBy(geoMentionChecks.promptId);
}

/**
 * Prompts Autopilot already suggested pausing, in any state. An accepted one
 * counts too: the unique index would drop a second suggestion anyway, and it
 * must not take a slot from a prompt that can still be suggested.
 */
async function listHandledTargets(organizationId: string, projectId: string) {
  const rows = await db
    .select({ targetPromptId: geoPromptSuggestions.targetPromptId })
    .from(geoPromptSuggestions)
    .where(
      and(
        eq(geoPromptSuggestions.organizationId, organizationId),
        eq(geoPromptSuggestions.projectId, projectId),
        eq(geoPromptSuggestions.source, "autopilot"),
        inArray(geoPromptSuggestions.status, [
          "pending",
          "accepted",
          "dismissed",
        ])
      )
    );
  return new Set(rows.map((row) => row.targetPromptId));
}

/**
 * Finds tracked prompts whose answers name no brand at all (not you, not any
 * competitor the judge saw) and suggests pausing them on the Prompts page.
 * Prompts that only name brands you don't track stay: they show who you miss. Free: it reads
 * scan results only and never changes a prompt by itself.
 */
export async function runPromptsJob(
  ctx: AutopilotRunContext
): Promise<AutopilotJobResult> {
  const result: AutopilotJobResult = { findingIds: [], insights: [] };
  const log = createAutopilotLogger(ctx, "prompts");
  const projectId = ctx.projectId;
  if (!projectId) {
    await log.skip("No GEO project to review");
    return result;
  }
  const since = new Date(
    Date.now() - AUTOPILOT_PROMPT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );
  const [tracked, stats, handled] = await Promise.all([
    Effect.runPromise(
      listGeoPrompts({ organizationId: ctx.organizationId, projectId }).pipe(
        Effect.provide(geoCoreDashboardLayer)
      )
    ),
    loadPromptStats(projectId, since),
    listHandledTargets(ctx.organizationId, projectId),
  ]);
  const statsByScanId = new Map(stats.map((row) => [row.promptId, row]));
  const active = tracked.prompts.filter((prompt) => prompt.enabled);

  const reviewed = active.map((prompt) => {
    const stat = statsByScanId.get(trackedPromptScanId(prompt));
    let verdict = "keep";
    if (handled.has(prompt.id)) {
      verdict = "already suggested or dismissed";
    } else if (
      !stat ||
      stat.scans < AUTOPILOT_PROMPT_DEAD_MIN_SCANS ||
      stat.answers < AUTOPILOT_PROMPT_DEAD_MIN_ANSWERS
    ) {
      verdict = "not enough scans yet";
    } else if (stat.mentioned === 0 && stat.withCompetitors === 0) {
      verdict = "dead";
    }
    return { prompt, stat: stat ?? null, verdict };
  });
  await log.trace("Prompt review: every tracked prompt and its numbers", {
    lookbackDays: AUTOPILOT_PROMPT_LOOKBACK_DAYS,
    prompts: reviewed.map((row) => ({
      id: row.prompt.id,
      prompt: row.prompt.prompt,
      verdict: row.verdict,
      answers: row.stat?.answers ?? 0,
      scans: row.stat?.scans ?? 0,
      mentioned: row.stat?.mentioned ?? 0,
      withCompetitors: row.stat?.withCompetitors ?? 0,
    })),
  });

  const dead = reviewed
    .filter((row) => row.verdict === "dead")
    .slice(0, AUTOPILOT_PROMPT_MAX_SUGGESTIONS);
  await log.decision(
    `${dead.length} of ${active.length} active prompts get answers that name no brand`,
    {
      active: active.length,
      notEnoughScans: reviewed.filter(
        (row) => row.verdict === "not enough scans yet"
      ).length,
      dead: dead.map((row) => row.prompt.prompt),
    }
  );
  if (dead.length === 0) {
    return result;
  }
  // Idempotent: a retried run or an older identical suggestion is skipped.
  const inserted = await db
    .insert(geoPromptSuggestions)
    .values(
      dead.map((row) => ({
        id: crypto.randomUUID(),
        organizationId: ctx.organizationId,
        projectId,
        prompt: row.prompt.prompt,
        source: "autopilot" as const,
        action: "pause" as const,
        targetPromptId: row.prompt.id,
        reason: `In ${row.stat?.answers ?? 0} answers over the last ${AUTOPILOT_PROMPT_LOOKBACK_DAYS} days, no engine named any brand, so this prompt doesn't measure your visibility.`,
        reasonData: {
          kind: "no_brands" as const,
          answers: row.stat?.answers ?? 0,
          lookbackDays: AUTOPILOT_PROMPT_LOOKBACK_DAYS,
        },
      }))
    )
    .onConflictDoNothing()
    .returning({ prompt: geoPromptSuggestions.prompt });
  if (inserted.length === 0) {
    return result;
  }
  await log.action(`Suggested pausing ${inserted.length} prompts`, {
    prompts: inserted.map((row) => row.prompt),
  });
  const count = inserted.length;
  result.insights.push(
    `${count} tracked ${count === 1 ? "prompt gets" : "prompts get"} answers that name no brand at all. Pausing ${count === 1 ? "it" : "them"} is suggested on the Prompts page.`
  );
  return result;
}
