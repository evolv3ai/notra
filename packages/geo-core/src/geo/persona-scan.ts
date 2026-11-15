import { db } from "@notra/db/drizzle";
import { geoPersonaMemories, geoPersonas, geoSettings } from "@notra/db/schema";
import type { GeoCheckWrite } from "@notra/db/types/geo-checks";
import type { GeoPersonaSnapshotV2 } from "@notra/db/types/geo-personas";
import { insertGeoMentionChecksWithSummary } from "@notra/db/utils/geo-checks";
import { createPersonaSnapshot } from "@notra/db/utils/persona-snapshot";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Effect } from "effect";

import { GEO_JUDGE_MODEL, GEO_SCAN_CONCURRENCY } from "../constants/geo";
import {
  GEO_PERSONA_BILLING_MULTIPLIER,
  GEO_PERSONA_MAX_TURNS,
  GEO_PERSONA_PAIR_TIMEOUT_MS,
} from "../constants/geo-personas";
import type {
  GeoCheckContext,
  GeoGroundedEngine,
  GeoScanBatchOutcome,
  GeoScanPlannedPersona,
  GeoScanProjectContext,
  GeoScopeInput,
  GeoSkipFields,
  GeoZdrMode,
} from "../types/geo";
import type {
  GeoConversationEngine,
  GeoPlannedPersonaOutcome,
} from "../types/geo-conversations";
import type {
  GeoPersonaRunResponse,
  PersonaForScan,
} from "../types/geo-personas";
import { resolveGeoConversationEngine } from "../utils/geo-conversation-engine";
import { resolveGeoGroundedZdrMode } from "../utils/geo-engines";
import { resolveGroundedEngines } from "../utils/geo-grounded-engines";
import { flushGeoLogEffect, geoLogWarn } from "../utils/geo-log";
import { personaPromptId } from "../utils/geo-personas";
import {
  batchUsageOf,
  withGeoScanEvent,
  withGeoScanStep,
} from "../utils/geo-scan-event";
import { geoScanPersonaTasks } from "../utils/geo-scan-plan";
import {
  addAgentTokenUsage as addTokenUsage,
  EMPTY_AGENT_TOKEN_USAGE as EMPTY_TOKEN_USAGE,
  scaleAgentTokenUsage,
} from "../utils/token-usage";
import { runGeoConversation } from "./conversation";
import { runGeoConversationReplay } from "./conversation-replay";
import { geoSkip } from "./effect";
import {
  GeoPersonaNotFoundError,
  GeoPersonaRunError,
  GeoPersonaRunUnavailableError,
  GeoScanError,
  GeoSettingsMissingError,
} from "./errors";
import { toGeoSettings } from "./mappers";
import { loadGeoModelCatalog } from "./model-catalog";
import {
  queueGeoOlostepConversationScan,
  resolveGeoManualOlostepEngines,
} from "./olostep-conversation-scan";
import { loadGeoProjectBrand } from "./project-brand";
import { requireGeoProject } from "./projects";
import { buildGeoScanCheckContext } from "./scan-context";
import {
  omitGeoScanTasks,
  updateGeoScanAnswerStatus,
} from "./scan-task-status";
import { resolveScanZdrPolicy } from "./zdr-policy";

function personaFailureFields(
  context: GeoCheckContext,
  personaId: string,
  engine: string
): GeoSkipFields {
  return {
    event: "geo.check.failed",
    organizationId: context.organizationId,
    projectId: context.projectId,
    scanId: context.scanId,
    engine,
    promptId: personaPromptId(personaId),
    personaId,
    grounded: true,
  };
}

const loadPersonaForScan = Effect.fn("geo.persona.load")(function* (
  projectId: string,
  personaId: string
) {
  const row = yield* Effect.tryPromise({
    try: () =>
      db.query.geoPersonas.findFirst({
        with: {
          memories: {
            orderBy: [
              asc(geoPersonaMemories.createdAt),
              asc(geoPersonaMemories.id),
            ],
          },
        },
        where: and(
          eq(geoPersonas.id, personaId),
          eq(geoPersonas.projectId, projectId),
          isNull(geoPersonas.archivedAt)
        ),
      }),
    catch: (cause) =>
      new GeoScanError({ message: "Failed to load the persona", cause }),
  });
  if (!row) {
    return null;
  }
  const loaded: PersonaForScan & { enabled: boolean } = {
    enabled: row.enabled,
    persona: {
      id: row.id,
      name: row.name,
      role: row.role,
      company: row.company,
      summary: row.summary,
      searchStyle: row.searchStyle,
      profile: row.profile,
    },
    conversationPrompts: row.conversationPrompts,
    memories: row.memories.map((memory) => ({
      id: memory.id,
      kind: memory.kind,
      content: memory.content,
    })),
  };
  return loaded;
});

/**
 * Plays one persona's fixed prompts against one search-grounded engine. Rows
 * carry `personaId` so they stay out of the prompt aggregates.
 */
export const runGeoPersonaConversation = Effect.fn(
  "geo.runPersonaConversation"
)(function* (
  context: GeoCheckContext,
  snapshot: GeoPersonaSnapshotV2,
  grounded: GeoConversationEngine,
  zdr: GeoZdrMode
) {
  return yield* runGeoConversation(
    context,
    {
      promptId: personaPromptId(snapshot.persona.id),
      personaId: snapshot.persona.id,
      prompts: snapshot.conversationPrompts,
      snapshot,
      timeoutMs: GEO_PERSONA_PAIR_TIMEOUT_MS,
    },
    grounded,
    zdr
  );
});

const runPlannedPersona = Effect.fn("geo.runPlannedPersona")(function* (
  checkContext: GeoCheckContext,
  planned: GeoScanPlannedPersona
) {
  const tasks = geoScanPersonaTasks(planned);
  const grounded = resolveGeoConversationEngine(planned);
  if (!grounded || !planned.snapshot) {
    yield* omitGeoScanTasks(
      checkContext,
      tasks.map((task) => task.key)
    ).pipe(geoSkip("scan plan update failed"));
    return null;
  }
  const current = yield* Effect.tryPromise({
    try: () =>
      db.query.geoPersonas.findFirst({
        columns: { enabled: true },
        where: and(
          eq(geoPersonas.id, planned.personaId),
          eq(geoPersonas.projectId, checkContext.projectId),
          isNull(geoPersonas.archivedAt)
        ),
      }),
    catch: (cause) =>
      new GeoScanError({ message: "Failed to load the persona", cause }),
  });
  if (!current?.enabled) {
    yield* omitGeoScanTasks(
      checkContext,
      tasks.map((task) => task.key)
    ).pipe(geoSkip("scan plan update failed"));
    // Omitted turns are not failures, so a paused persona must not land in
    // `dropped` the way a crashed run does, nor in the workflow's attempted
    // count (a scan of only paused personas must not fail and retry).
    const paused: GeoPlannedPersonaOutcome = {
      rows: [],
      usage: EMPTY_TOKEN_USAGE,
      engineUsage: EMPTY_TOKEN_USAGE,
      judgeUsage: EMPTY_TOKEN_USAGE,
      droppedTurns: 0,
      omitted: true,
    };
    return paused;
  }
  yield* Effect.forEach(
    tasks,
    (task) => updateGeoScanAnswerStatus(checkContext, task, "running"),
    { concurrency: GEO_SCAN_CONCURRENCY }
  );
  const outcome = yield* runGeoPersonaConversation(
    checkContext,
    planned.snapshot,
    grounded,
    planned.zdr
  );
  const remaining = tasks.filter(
    (task) => !outcome.rows.some((row) => row.turn === task.turn)
  );
  yield* Effect.forEach(
    remaining,
    (task) => updateGeoScanAnswerStatus(checkContext, task, "failed"),
    { concurrency: GEO_SCAN_CONCURRENCY }
  );
  const ran: GeoPlannedPersonaOutcome = outcome;
  return ran;
});

/** Runs one batch of persona conversations; same contract as `runGeoScanSequenceBatch`. */
export const runGeoScanPersonaBatch = Effect.fn("geo.runScanPersonaBatch")(
  function* (
    context: GeoScanProjectContext,
    plannedPersonas: readonly GeoScanPlannedPersona[]
  ) {
    return yield* withGeoScanStep(
      context,
      "persona_batch",
      runGeoScanPersonaBatchBody(context, plannedPersonas),
      batchUsageOf
    );
  }
);

const runGeoScanPersonaBatchBody = Effect.fn("geo.runScanPersonaBatch.body")(
  function* (
    context: GeoScanProjectContext,
    plannedPersonas: readonly GeoScanPlannedPersona[]
  ) {
    const checkContext = yield* buildGeoScanCheckContext(context);

    const outcomes = yield* Effect.forEach(
      plannedPersonas,
      (planned) => {
        const fields = personaFailureFields(
          checkContext,
          planned.personaId,
          planned.engine
        );
        return withGeoScanEvent(
          runPlannedPersona(checkContext, planned),
          { ...fields, event: "geo.check.attempt.completed" },
          {
            scanId: context.scanId,
            runId: context.runId,
            step: "check",
            engine: planned.engine,
            taskKey: planned.personaId,
            persistSuccess: false,
          }
        ).pipe(geoSkip("persona conversation failed", fields));
      },
      { concurrency: GEO_SCAN_CONCURRENCY }
    );

    const rows: GeoCheckWrite[] = [];
    let dropped = 0;
    let omitted = 0;
    let engineUsage = EMPTY_TOKEN_USAGE;
    let judgeUsage = EMPTY_TOKEN_USAGE;
    for (const [index, outcome] of outcomes.entries()) {
      if (!outcome) {
        const planned = plannedPersonas[index];
        dropped += planned ? geoScanPersonaTasks(planned).length : 0;
        continue;
      }
      if (outcome.omitted) {
        omitted += 1;
      }
      dropped += outcome.droppedTurns;
      rows.push(...outcome.rows);
      engineUsage = addTokenUsage(
        engineUsage,
        outcome.engineUsage ?? EMPTY_TOKEN_USAGE
      );
      judgeUsage = addTokenUsage(
        judgeUsage,
        outcome.judgeUsage ?? EMPTY_TOKEN_USAGE
      );
    }
    let checks = 0;
    let mentions = 0;
    if (rows.length > 0) {
      const inserted = yield* Effect.tryPromise({
        try: () => insertGeoMentionChecksWithSummary(rows),
        catch: (cause) =>
          new GeoScanError({ message: "Failed to store GEO checks", cause }),
      });
      checks = inserted.checks;
      mentions = inserted.mentions;
    }

    const usage = addTokenUsage(engineUsage, judgeUsage);
    const result: GeoScanBatchOutcome = {
      checks,
      mentions,
      dropped,
      usage,
      engineUsage,
      judgeUsage,
      billedChecks: checks * GEO_PERSONA_BILLING_MULTIPLIER,
      billedUsage: scaleAgentTokenUsage(usage, GEO_PERSONA_BILLING_MULTIPLIER),
      omitted,
    };
    return result;
  }
);

/**
 * Plays one persona against every available grounded engine right away,
 * outside the scheduled scan; consumer-app engines go to a scan scoped to
 * this persona. Mirrors `runGeoSequenceNow`: its own `geo_scans` row, its
 * own billing reservation, and the project scan slot when it is free.
 */
const runGeoPersonaNowProgram = Effect.fn("geo.runPersonaNow")(function* (
  input: GeoScopeInput,
  personaId: string
) {
  const scope = yield* requireGeoProject(input);
  const projectId = scope.projectId;

  const loaded = yield* loadPersonaForScan(projectId, personaId).pipe(
    Effect.mapError(
      (error) =>
        new GeoPersonaRunError({ message: error.message, cause: error.cause })
    )
  );
  if (!loaded) {
    return yield* Effect.fail(new GeoPersonaNotFoundError({ personaId }));
  }
  if (!loaded.enabled || loaded.conversationPrompts.length === 0) {
    return yield* Effect.fail(new GeoPersonaRunUnavailableError({}));
  }

  const settingsRow = yield* Effect.tryPromise({
    try: () =>
      db.query.geoSettings.findFirst({
        where: eq(geoSettings.projectId, projectId),
      }),
    catch: (cause) =>
      new GeoPersonaRunError({
        message: "Failed to load GEO settings",
        cause,
      }),
  });
  if (!settingsRow) {
    return yield* Effect.fail(
      new GeoSettingsMissingError({ organizationId: scope.organizationId })
    );
  }

  const catalog = yield* loadGeoModelCatalog(scope.organizationId);
  const settings = toGeoSettings(settingsRow, catalog);
  const zdrPolicy = yield* resolveScanZdrPolicy(
    scope.organizationId,
    settings,
    { projectId, personaId }
  );

  const groundedEngines: { grounded: GeoGroundedEngine; zdr: GeoZdrMode }[] =
    [];
  for (const grounded of resolveGroundedEngines(settings.engines, catalog)) {
    const zdr = resolveGeoGroundedZdrMode(catalog, grounded, zdrPolicy);
    if (zdr === null) {
      yield* geoLogWarn({
        event: "geo.scan.skipped",
        reason: "zdr",
        organizationId: scope.organizationId,
        projectId,
        personaId,
        engine: grounded.key,
      });
      continue;
    }
    groundedEngines.push({ grounded, zdr });
  }
  const skipFields = {
    organizationId: scope.organizationId,
    projectId,
    personaId,
  };
  const olostepEngines = yield* resolveGeoManualOlostepEngines(
    catalog,
    settings.engines,
    zdrPolicy,
    skipFields
  );
  if (groundedEngines.length === 0 && olostepEngines.length === 0) {
    return yield* Effect.fail(new GeoPersonaRunUnavailableError({}));
  }
  const queued = yield* queueGeoOlostepConversationScan(
    input,
    personaPromptId(personaId),
    olostepEngines,
    skipFields,
    groundedEngines.length === 0
  );
  if (groundedEngines.length === 0) {
    const response: GeoPersonaRunResponse = {
      checks: 0,
      mentions: 0,
      engines: [],
      queuedScanId: queued?.scanId ?? null,
      queuedEngines: olostepEngines,
    };
    return response;
  }

  const runId = `geo-persona-${personaId}-${crypto.randomUUID()}`;
  const snapshot = createPersonaSnapshot(
    loaded.persona,
    loaded.memories,
    loaded.conversationPrompts.slice(0, GEO_PERSONA_MAX_TURNS)
  );
  const brand = yield* loadGeoProjectBrand({
    organizationId: scope.organizationId,
    projectId,
  });
  const result = yield* runGeoConversationReplay(
    {
      context: {
        runId,
        organizationId: scope.organizationId,
        projectId,
        catalog,
        companyName: settings.companyName,
        aliases: settings.aliases,
        companyDescription: brand?.companyDescription ?? null,
        websiteUrl: brand?.websiteUrl ?? null,
        domains: settings.domains,
      },
      fallbackModelId: groundedEngines[0]?.grounded.model ?? GEO_JUDGE_MODEL,
      properties: { source: "geo_persona_run", persona_id: personaId },
      billingMultiplier: GEO_PERSONA_BILLING_MULTIPLIER,
      logPrefix: "GeoPersonaRun",
      emptyMessage: "Engines failed to answer this persona. Try again.",
    },
    (context) =>
      Effect.forEach(
        groundedEngines,
        ({ grounded, zdr }) =>
          runGeoPersonaConversation(context, snapshot, grounded, zdr).pipe(
            geoSkip(
              "persona run failed",
              personaFailureFields(context, personaId, grounded.key)
            )
          ),
        { concurrency: GEO_SCAN_CONCURRENCY }
      )
  ).pipe(
    // The consumer apps are already queued and billed on their own scan, so
    // the run still succeeds when no API engine answered.
    Effect.catchTag("GeoConversationNoAnswersError", (error) =>
      queued ? Effect.succeed(null) : Effect.fail(error)
    ),
    Effect.mapError((error) =>
      error._tag === "GeoWriterCreditsExhaustedError"
        ? error
        : new GeoPersonaRunError({ message: error.message, cause: error })
    )
  );

  const response: GeoPersonaRunResponse = {
    checks: result?.checks ?? 0,
    mentions: result?.mentions ?? 0,
    engines: result ? groundedEngines.map(({ grounded }) => grounded.key) : [],
    queuedScanId: queued?.scanId ?? null,
    queuedEngines: queued ? olostepEngines : [],
  };
  return response;
});

export function runGeoPersonaNow(input: GeoScopeInput, personaId: string) {
  return runGeoPersonaNowProgram(input, personaId).pipe(
    Effect.ensuring(flushGeoLogEffect)
  );
}
