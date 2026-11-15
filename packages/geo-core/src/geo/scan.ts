import {
  askGeoOpenCode,
  askGeoOpenCodeConversation,
} from "@notra/ai/agents/geo-opencode";
import { FEATURES } from "@notra/ai/billing/features";
import { GEO_OPENCODE_BOX_MODEL_ID } from "@notra/ai/constants/geo-opencode";
import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import type { GatewayModelOptions } from "@notra/ai/types/gateway";
import type { GeoBoxAnswer } from "@notra/ai/types/geo-opencode";
import { describeContentBillingDenial } from "@notra/ai/utils/content-billing-messages";
import {
  EMPTY_GEO_CHECK_GROUNDING,
  GEO_CHECK_GROUNDING_MAX_SOURCES,
} from "@notra/db/constants/geo-checks";
import { db } from "@notra/db/drizzle";
import {
  geoPersonas,
  geoPersonaMemories,
  geoPromptSequences,
  geoScans,
  geoSettings,
} from "@notra/db/schema";
import type { GeoCheckWrite } from "@notra/db/types/geo-checks";
import { insertGeoMentionChecks } from "@notra/db/utils/geo-checks";
import { createPersonaSnapshot } from "@notra/db/utils/persona-snapshot";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_ANSWER_TIMEOUT_MS,
  GEO_CODING_AGENT_ENGINE_IDS,
  GEO_CURSOR_TIMEOUT_MS,
  GEO_EXCERPT_MAX_LENGTH,
  GEO_JUDGE_MODEL,
  GEO_MAX_SEQUENCES,
  GEO_OPENCODE_ANSWER_SYSTEM_PROMPT,
  GEO_OPENCODE_ENGINE_ID,
  GEO_PAID_CODING_AGENT_ENGINE_IDS,
  GEO_SCAN_BILLING_LOCK_TTL_MS,
  GEO_SCAN_CONCURRENCY,
  GEO_SEQUENCE_PAIR_TIMEOUT_MS,
  GEO_SEQUENCE_MAX_TURNS,
} from "../constants/geo";
import { GEO_AI_OVERVIEW_ABSENT_ANSWER } from "../constants/geo-ai-overview";
import { MAX_JUDGE_COMPETITORS } from "../constants/geo-conversations";
import {
  GEO_PERSONA_BILLING_MULTIPLIER,
  GEO_PERSONA_MAX_COUNT,
  GEO_PERSONA_MAX_TURNS,
  GEO_PERSONA_PROMPT_ID_PREFIX,
} from "../constants/geo-personas";
import { GeoContentBillingService, GeoModelService } from "../deps";
import type { GeoContentBillingServiceShape } from "../types/deps";
import type {
  GeoCheckContext,
  GeoCheckOutcome,
  GeoCheckTask,
  GeoEngineAnswer,
  GeoGroundedEngine,
  GeoModelGateway,
  GeoScanBatchOutcome,
  GeoScanFailureMetadata,
  GeoScanPlannedPersona,
  GeoScanPlannedSequence,
  GeoScanPlannedTask,
  GeoScanProjectContext,
  GeoScanProjectPlan,
  GeoScanProjectPlanResult,
  GeoScanProjectTotals,
  GeoScanSkipReason,
  GeoScopeInput,
  GeoSequenceCheckOutcome,
  GeoSequenceDefinition,
  GeoSequenceRunResponse,
  GeoSettingsRow,
  GeoSkipFields,
  GeoZdrMode,
} from "../types/geo";
import type { GeoConversationEngine } from "../types/geo-conversations";
import { logGeoBillingFailure } from "../utils/geo-billing-log";
import { normalizePosition } from "../utils/geo-check-evaluation";
import {
  geoBoxAgentForEngine,
  isGeoBoxCodingAgent,
} from "../utils/geo-coding-agents";
import { isGeoContextEngine } from "../utils/geo-context";
import {
  isGeoConsumerConversationEngine,
  resolveGeoConversationEngine,
} from "../utils/geo-conversation-engine";
import { engineModelOf } from "../utils/geo-engine-family";
import {
  geoScanEmptyEngineSkipReason,
  isPartialGeoScanEngineScope,
  resolveGeoEngineGateway,
  resolveGeoGroundedZdrMode,
  resolveGeoZdrMode,
  scopeGeoScanEngines,
} from "../utils/geo-engines";
import {
  resolveGroundedEngineByKey,
  resolveGroundedEngines,
} from "../utils/geo-grounded-engines";
import {
  flushGeoLogEffect,
  geoLogError,
  geoLogInfo,
  geoLogWarn,
  logGeoSkip,
} from "../utils/geo-log";
import { hasOwnedSourceCitation } from "../utils/geo-owned-source";
import {
  interleaveGeoScanItemsByKey,
  isGeoScanRunning,
  summarizeGeoEngineAttempts,
} from "../utils/geo-scan";
import {
  batchUsageOf,
  withGeoScanEvent,
  withGeoScanStep,
} from "../utils/geo-scan-event";
import {
  geoScanAnswerKey,
  geoScanPlanSnapshot,
  geoScanPlanSummary,
  geoScanSequenceTasks,
} from "../utils/geo-scan-plan";
import { withPublicUrls } from "../utils/reference-display";
import {
  addAgentTokenUsage as addTokenUsage,
  agentTokenUsageFrom,
  EMPTY_AGENT_TOKEN_USAGE as EMPTY_TOKEN_USAGE,
  geoCheckWriteUsage,
  snapshotUsageByRole,
} from "../utils/token-usage";
import { judgeAnswer, requireAnswerText } from "./check-evaluation";
import { requireGeoCodingAgentAccess } from "./coding-agent-access";
import { askGeoContextAnswer } from "./context";
import { runGeoConversation } from "./conversation";
import { runGeoConversationReplay } from "./conversation-replay";
import { askCursorEngine } from "./cursor";
import { geoSkip } from "./effect";
import {
  GeoEmptyAnswerError,
  GeoJudgeError,
  GeoScanError,
  GeoSequenceNotFoundError,
  GeoSequenceRunError,
  GeoSequenceRunUnavailableError,
  GeoSettingsMissingError,
  GeoWriterCreditsExhaustedError,
} from "./errors";
import { extractGrounding } from "./grounding";
import { toGeoSettings } from "./mappers";
import { loadGeoModelCatalog } from "./model-catalog";
import { askGeoOlostepAnswer } from "./olostep";
import {
  queueGeoOlostepConversationScan,
  resolveGeoManualOlostepEngines,
} from "./olostep-conversation-scan";
import { loadGeoProjectBrand } from "./project-brand";
import { requireGeoProject } from "./projects";
import { syncGeoPromptTranslations } from "./prompt-translations";
import { scopeGeoPrompts } from "./prompts";
import { buildGeoScanCheckContext } from "./scan-context";
import { loadGeoScanPrompts } from "./scan-prompts";
import {
  claimGeoScanRun,
  createGeoScanRow,
  failPendingGeoScanRow,
  finishGeoScanRow,
  markGeoScanFinished,
  parseGeoClaimToken,
  releaseGeoScanRun,
  renewGeoScanRun,
} from "./scan-status";
import {
  updateGeoScanAnswerStatus,
  updateGeoScanTaskStatus,
} from "./scan-task-status";
import { resolveScanZdrPolicy } from "./zdr-policy";

const SEQUENCE_PROMPT_ID_PREFIX = "sequence-";

function skippedPlan(reason: GeoScanSkipReason): GeoScanProjectPlanResult {
  return { status: "skipped", reason };
}

function sequencePromptId(sequenceId: string): string {
  return `${SEQUENCE_PROMPT_ID_PREFIX}${sequenceId}`;
}

/** Ids of the conversations a manual run scoped a scan to, by prompt id. */
function scopedConversationIds(
  promptIds: readonly string[] | undefined,
  prefix: string
): string[] {
  return (promptIds ?? []).flatMap((promptId) =>
    promptId.startsWith(prefix) ? [promptId.slice(prefix.length)] : []
  );
}

function sequenceTurnCount(sequence: GeoSequenceDefinition): number {
  return Math.min(sequence.steps.length, GEO_SEQUENCE_MAX_TURNS);
}

function checkFailureFields(
  context: GeoCheckContext,
  task: GeoCheckTask
): GeoSkipFields {
  return {
    event: "geo.check.failed",
    organizationId: context.organizationId,
    projectId: context.projectId,
    scanId: context.scanId,
    engine: task.engine,
    runId: context.runId,
    promptId: task.prompt.id,
    language: task.language,
    grounded: task.grounded !== null,
  };
}

function sequenceFailureFields(
  context: GeoCheckContext,
  sequence: GeoSequenceDefinition,
  engine: string,
  grounded: boolean
): GeoSkipFields {
  return {
    event: "geo.check.failed",
    organizationId: context.organizationId,
    projectId: context.projectId,
    scanId: context.scanId,
    engine,
    runId: context.runId,
    promptId: sequencePromptId(sequence.id),
    sequenceId: sequence.id,
    language: sequence.language,
    grounded,
  };
}

function droppedCheckOutcome(
  fields: GeoSkipFields,
  error: GeoEmptyAnswerError | GeoJudgeError | GeoScanError
): GeoCheckOutcome {
  logGeoSkip("check failed", fields, error);
  const engineUsage = error.usage
    ? addTokenUsage(EMPTY_TOKEN_USAGE, error.usage)
    : EMPTY_TOKEN_USAGE;
  return {
    row: null,
    usage: engineUsage,
    engineUsage,
    judgeUsage: EMPTY_TOKEN_USAGE,
  };
}

function toBoxEngineAnswer(result: GeoBoxAnswer): GeoEngineAnswer {
  return {
    text: result.text,
    grounding: extractGrounding({
      ...result,
      sources: [...result.groundingSources, ...result.sources],
    }),
    sources: withPublicUrls(result.sources),
    finishReason: "stop",
    usage: result.usage,
    zdrEnforced: false,
  };
}

/** Waits for a box run to settle so an interrupted scan never leaks its sandbox. */
function awaitBoxSettled(pending: () => Promise<unknown> | null) {
  return Effect.uninterruptible(
    Effect.promise(
      () =>
        pending()?.then(
          () => undefined,
          () => undefined
        ) ?? Promise.resolve()
    )
  );
}

function releaseGeoScanBilling(
  billing: GeoContentBillingServiceShape,
  gate: GeoScanProjectContext["gate"],
  projectId: string,
  runId: string
) {
  return billing
    .finalizeContentBilling({
      reservation: gate,
      action: "release",
      logPrefix: "GeoScan",
    })
    .pipe(
      Effect.catch((releaseError) =>
        Effect.sync(() => {
          logGeoBillingFailure("release", projectId, runId, releaseError);
        })
      )
    );
}

const askOpenCodeEngineEffect = Effect.fn("geo.askOpenCodeEngine")(function* (
  engine: string,
  promptText: string
) {
  const deadlineAtMs = Date.now() + GEO_ANSWER_TIMEOUT_MS;
  const boxAgent = geoBoxAgentForEngine(engine);
  let openCodePromise: ReturnType<typeof askGeoOpenCode> | null = null;
  let completedResult: GeoBoxAnswer | undefined;
  let reportedUsage: GeoBoxAnswer["usage"] | undefined;
  const result = yield* Effect.tryPromise({
    try: (signal) => {
      openCodePromise = askGeoOpenCode(
        `${GEO_OPENCODE_ANSWER_SYSTEM_PROMPT}\n\nUser question:\n${promptText}`,
        signal,
        deadlineAtMs,
        boxAgent?.model ?? GEO_OPENCODE_BOX_MODEL_ID,
        boxAgent?.harness,
        (result) => {
          completedResult = result;
        },
        (usage) => {
          reportedUsage = usage;
        }
      );
      return openCodePromise;
    },
    catch: (cause) =>
      new GeoScanError({
        message: `Engine ${engine} failed to answer`,
        timedOut:
          cause instanceof DOMException && cause.name === "TimeoutError",
        cause,
        usage: reportedUsage,
      }),
  }).pipe(
    Effect.ensuring(awaitBoxSettled(() => openCodePromise)),
    Effect.timeoutOrElse({
      duration: Math.max(1, deadlineAtMs - Date.now()),
      orElse: () =>
        Effect.fail(
          new GeoScanError({
            message: `Engine ${engine} timed out after ${GEO_ANSWER_TIMEOUT_MS}ms`,
            timedOut: true,
            usage: reportedUsage,
          })
        ),
    }),
    Effect.catchTag("GeoScanError", (error) => {
      const recovered = completedResult;
      if (!recovered) {
        return Effect.fail(error);
      }
      return Effect.sync(() => {
        logGeoSkip("native answer failed", { engine }, error);
        return recovered;
      });
    })
  );
  return toBoxEngineAnswer(result);
});

const askCursorEngineEffect = Effect.fn("geo.askCursorEngine")(function* (
  engine: string,
  promptText: string
) {
  const text = yield* askCursorEngine(promptText).pipe(
    Effect.mapError(
      (cause) =>
        new GeoScanError({
          message: `Engine ${engine} failed to answer`,
          cause,
        })
    ),
    Effect.timeoutOrElse({
      duration: GEO_CURSOR_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new GeoScanError({
            message: `Engine ${engine} timed out after ${GEO_CURSOR_TIMEOUT_MS}ms`,
            timedOut: true,
          })
        ),
    })
  );
  const answer: GeoEngineAnswer = {
    text,
    grounding: EMPTY_GEO_CHECK_GROUNDING,
    sources: [],
    finishReason: null,
    zdrEnforced: false,
  };
  return answer;
});

const askEngine = Effect.fn("geo.askEngine")(function* (
  organizationId: string,
  engine: string,
  promptText: string,
  zdr: GeoZdrMode,
  gatewayPin: GeoModelGateway | undefined,
  logContext: GatewayModelOptions["logContext"],
  olostepRetrieveId?: string,
  language = DEFAULT_LANGUAGE
) {
  if (gatewayPin === "context") {
    return yield* askGeoContextAnswer(engine, promptText, language);
  }
  if (gatewayPin === "olostep") {
    return yield* askGeoOlostepAnswer(engine, olostepRetrieveId);
  }
  if (GEO_PAID_CODING_AGENT_ENGINE_IDS.includes(engine)) {
    yield* requireGeoCodingAgentAccess(organizationId);
  }
  if (gatewayPin === "cursor") {
    return yield* askCursorEngineEffect(engine, promptText);
  }
  if (gatewayPin === "box") {
    return yield* askOpenCodeEngineEffect(engine, promptText);
  }
  const models = yield* GeoModelService;
  return yield* models.answer({
    organizationId,
    engine,
    prompt: promptText,
    zdr,
    gateway: gatewayPin,
    logContext,
  });
});

const runGeoCheck = Effect.fn("geo.runCheck")(function* (
  context: GeoCheckContext,
  task: GeoCheckTask
) {
  const startedMs = performance.now();
  const models = yield* GeoModelService;
  const logContext = {
    projectId: context.projectId,
    scanId: context.scanId,
    runId: context.runId,
    promptId: task.prompt.id,
  };
  const grounded = task.grounded
    ? yield* models.groundedAnswer({
        organizationId: context.organizationId,
        engine: task.grounded,
        messages: [{ role: "user", content: task.prompt.text }],
        zdr: task.zdr,
        logContext,
      })
    : null;
  const answer =
    grounded ??
    (yield* askEngine(
      context.organizationId,
      task.engine,
      task.prompt.text,
      task.zdr,
      resolveGeoEngineGateway(context.catalog, task.engine),
      logContext,
      task.olostepRetrieveId,
      task.language
    ));
  const baseRow = {
    organizationId: context.organizationId,
    projectId: context.projectId,
    scanId: context.scanId,
    engine: task.engine,
    promptId: task.prompt.id,
    sequenceId: null,
    turn: 0,
    prompt: task.prompt.text,
    capturedAt: context.capturedAt,
    grounding: answer.grounding,
    finishReason: answer.finishReason,
    zdrEnforced: answer.zdrEnforced,
    language: task.language,
    sources: answer.sources,
    surfaces: answer.surfaces ?? null,
  };
  if (answer.absent) {
    const durationMs = Math.round(performance.now() - startedMs);
    const outcome: GeoCheckOutcome = {
      row: {
        ...baseRow,
        answer: GEO_AI_OVERVIEW_ABSENT_ANSWER,
        mentioned: false,
        ownedSourceCited: false,
        position: null,
        sentiment: null,
        competitors: [],
        excerpt: "",
        ...geoCheckWriteUsage(answer.usage, undefined, durationMs),
      },
      usage: EMPTY_TOKEN_USAGE,
      engineUsage: EMPTY_TOKEN_USAGE,
      judgeUsage: EMPTY_TOKEN_USAGE,
    };
    return outcome;
  }
  const answerText = yield* requireAnswerText(
    task.engine,
    task.prompt.id,
    task.language,
    answer
  );
  const judged = yield* judgeAnswer(
    context,
    task.prompt.text,
    answerText,
    logContext
  ).pipe(
    Effect.mapError((error) =>
      error._tag === "GeoJudgeError"
        ? new GeoJudgeError({
            message: error.message,
            timedOut: error.timedOut,
            cause: error.cause,
            usage: answer.usage,
          })
        : error
    )
  );
  const durationMs = Math.round(performance.now() - startedMs);
  const ownedSourceCited = hasOwnedSourceCitation(
    context.websiteUrl,
    answer.sources,
    context.domains
  );
  const engineUsage = agentTokenUsageFrom(answer.usage);
  const judgeUsage = agentTokenUsageFrom(judged.usage);
  if (task.zdr !== "none" && answer.zdrEnforced === false) {
    yield* geoLogWarn({
      ...checkFailureFields(context, task),
      event: "geo.check.zdr_relaxed",
      zdr: task.zdr,
    });
  }

  const outcome: GeoCheckOutcome = {
    row: {
      ...baseRow,
      answer: answerText,
      mentioned: judged.mentioned,
      ownedSourceCited,
      position: normalizePosition(judged.position),
      sentiment: judged.sentiment,
      competitors: judged.competitors.slice(0, MAX_JUDGE_COMPETITORS),
      excerpt: judged.excerpt.slice(0, GEO_EXCERPT_MAX_LENGTH),
      ...geoCheckWriteUsage(answer.usage, judged.usage, durationMs),
    },
    usage: addTokenUsage(engineUsage, judgeUsage),
    engineUsage,
    judgeUsage,
  };
  return outcome;
});

/**
 * Loads the settings rows a scan run covers and returns the enabled project
 * ids in creation order. A scoped run also releases its own claim when its
 * project was paused before it started planning.
 */
export const listGeoScanProjects = Effect.fn("geo.listScanProjects")(function* (
  organizationId: string,
  options: {
    projectId?: string;
    projectIds?: readonly string[];
    claimedAt?: Date;
    manual?: boolean;
  } = {}
) {
  const scopedProjectIds =
    options.projectIds ?? (options.projectId ? [options.projectId] : undefined);
  const settingsRows = yield* Effect.tryPromise({
    try: () =>
      db.query.geoSettings.findMany({
        columns: {
          projectId: true,
          enabled: true,
          scanStartedAt: true,
          lastScanAt: true,
        },
        where: scopedProjectIds
          ? and(
              eq(geoSettings.organizationId, organizationId),
              inArray(geoSettings.projectId, scopedProjectIds)
            )
          : eq(geoSettings.organizationId, organizationId),
        orderBy: [asc(geoSettings.createdAt)],
      }),
    catch: (cause) =>
      new GeoScanError({ message: "Failed to load GEO settings", cause }),
  });

  // A manual run of a paused project scans that one project anyway.
  const includes = (row: (typeof settingsRows)[number]) =>
    row.enabled ||
    (options.manual === true && row.projectId === options.projectId);

  for (const row of settingsRows) {
    if (includes(row) || !isGeoScanRunning(row.scanStartedAt, row.lastScanAt)) {
      continue;
    }
    // A legacy workflow without a claim token must not adopt and release
    // the claim of a manual run that started after it was queued.
    if (row.projectId !== options.projectId || !options.claimedAt) {
      continue;
    }
    yield* releaseGeoScanRun(row.projectId, options.claimedAt).pipe(
      geoSkip("scan claim release failed")
    );
  }

  const enabledRows = settingsRows.filter(includes);
  if (enabledRows.length === 0) {
    yield* geoLogWarn({
      event: "geo.scan.skipped",
      reason: "disabled",
      organizationId,
      projectId:
        scopedProjectIds?.length === 1 ? (scopedProjectIds[0] ?? null) : null,
    });
  }
  return enabledRows.map((row) => row.projectId);
});

/**
 * First step of a project scan: takes (or revalidates) the scan-slot claim,
 * reserves billing, materializes the `geo_scans` row, and compiles the full
 * task list — engines × prompts × languages plus grounded sequences — into a
 * serializable plan the batch steps execute. Everything that must happen
 * exactly once per scan lives here; everything model-call-shaped lives in the
 * batches.
 */
export const prepareGeoScanProject = Effect.fn("geo.prepareScanProject")(
  function* (
    organizationId: string,
    projectId: string,
    options: {
      claimedAt?: Date;
      scanId?: string;
      promptIds?: string[];
      engines?: string[];
      retried?: boolean;
      manual?: boolean;
    } = {}
  ) {
    const billing = yield* GeoContentBillingService;
    const settingsRow = yield* Effect.tryPromise({
      try: () =>
        db.query.geoSettings.findFirst({
          where: and(
            eq(geoSettings.organizationId, organizationId),
            eq(geoSettings.projectId, projectId)
          ),
        }),
      catch: (cause) =>
        new GeoScanError({ message: "Failed to load GEO settings", cause }),
    });

    const failHandedScanRow = options.scanId
      ? failPendingGeoScanRow(
          { organizationId, projectId },
          options.scanId
        ).pipe(geoSkip("scan row fail stamp failed"))
      : Effect.void;

    // A manual conversation or persona run is scoped to explicit prompt ids
    // and runs while automatic scans are paused.
    const manualScope =
      options.manual === true && options.promptIds !== undefined;
    if (!(settingsRow && (settingsRow.enabled || manualScope))) {
      if (options.claimedAt) {
        yield* releaseGeoScanRun(projectId, options.claimedAt).pipe(
          geoSkip("scan claim release failed")
        );
      }
      yield* failHandedScanRow;
      yield* geoLogWarn({
        event: "geo.scan.skipped",
        reason: "disabled",
        organizationId,
        projectId,
      });
      return skippedPlan("disabled");
    }

    let claimedAt: Date;
    if (options.claimedAt) {
      const renewed = yield* renewGeoScanRun(projectId, options.claimedAt);
      if (!renewed) {
        yield* failHandedScanRow;
        yield* geoLogWarn({
          event: "geo.scan.skipped",
          reason: "claim_lost",
          organizationId,
          projectId,
        });
        return skippedPlan("claim_lost");
      }
      claimedAt = renewed.claimedAt;
    } else {
      const claim = yield* claimGeoScanRun(projectId).pipe(
        geoSkip("scan claim failed")
      );
      if (!claim) {
        yield* geoLogWarn({
          event: "geo.scan.skipped",
          reason: "already_running",
          organizationId,
          projectId,
        });
        return skippedPlan("already_running");
      }
      claimedAt = claim.claimedAt;
    }

    const releaseClaim = releaseGeoScanRun(projectId, claimedAt).pipe(
      geoSkip("scan claim release failed")
    );

    const runId = `geo-scan-${projectId}-${crypto.randomUUID()}`;
    const gate = yield* billing
      .gateContentBilling({
        organizationId,
        executionId: runId,
        outputType: null,
        quotaFeatureId: FEATURES.AI_ANSWERS,
        lockTtlMs: GEO_SCAN_BILLING_LOCK_TTL_MS,
      })
      .pipe(
        Effect.mapError(
          (error) =>
            new GeoScanError({
              message: "Failed to reserve AI answers",
              cause: error.cause,
            })
        ),
        Effect.tapError(() =>
          releaseClaim.pipe(Effect.andThen(failHandedScanRow))
        )
      );
    if (!gate.allowed) {
      yield* geoLogWarn({
        event: "geo.scan.skipped",
        reason: "billing",
        organizationId,
        projectId,
        runId,
        detail: describeContentBillingDenial(gate),
      });
      yield* releaseClaim;
      yield* failHandedScanRow;
      return skippedPlan("billing");
    }

    const releaseBilling = releaseGeoScanBilling(
      billing,
      gate,
      projectId,
      runId
    );

    const scanId = yield* createGeoScanRow(
      { organizationId, projectId },
      options.scanId
    ).pipe(
      Effect.tapError(() =>
        releaseBilling.pipe(
          Effect.andThen(releaseClaim),
          Effect.andThen(failHandedScanRow)
        )
      )
    );

    const planResult = yield* withGeoScanStep(
      {
        organizationId,
        projectId,
        scanId,
        runId,
      },
      options.retried ? "retry" : "prepare",
      buildGeoScanProjectPlan(
        settingsRow,
        scanId,
        runId,
        gate,
        claimedAt,
        options.promptIds,
        options.engines
      ),
      (result) =>
        result.status === "planned"
          ? snapshotUsageByRole(
              EMPTY_TOKEN_USAGE,
              result.plan.usage ?? EMPTY_TOKEN_USAGE
            )
          : null
    ).pipe(
      Effect.tapError(() =>
        releaseBilling.pipe(
          Effect.andThen(releaseClaim),
          Effect.andThen(
            failPendingGeoScanRow({ organizationId, projectId }, scanId).pipe(
              geoSkip("scan row fail stamp failed")
            )
          )
        )
      )
    );
    if (planResult.status === "skipped") {
      yield* releaseBilling;
      yield* releaseClaim;
      yield* failPendingGeoScanRow({ organizationId, projectId }, scanId).pipe(
        geoSkip("scan row fail stamp failed")
      );
    }
    return planResult;
  }
);

const buildGeoScanProjectPlan = Effect.fn("geo.buildScanProjectPlan")(
  function* (
    settingsRow: GeoSettingsRow,
    scanId: string,
    runId: string,
    gate: GeoScanProjectContext["gate"],
    claimedAt: Date,
    promptIds?: readonly string[],
    requestedEngines?: readonly string[]
  ) {
    const organizationId = settingsRow.organizationId;
    const catalog = yield* loadGeoModelCatalog(organizationId);
    const settings = toGeoSettings(settingsRow, catalog);

    const { brand, prompts: allPrompts } = yield* loadGeoScanPrompts(settings);
    const prompts = promptIds
      ? scopeGeoPrompts(allPrompts, promptIds)
      : allPrompts;
    const scopedSequenceIds = scopedConversationIds(
      promptIds,
      SEQUENCE_PROMPT_ID_PREFIX
    );
    const scopedPersonaIds = scopedConversationIds(
      promptIds,
      GEO_PERSONA_PROMPT_ID_PREFIX
    );
    if (
      promptIds &&
      prompts.length === 0 &&
      scopedSequenceIds.length + scopedPersonaIds.length === 0
    ) {
      yield* geoLogWarn({
        event: "geo.scan.skipped",
        reason: "scoped_prompts_missing",
        organizationId,
        projectId: settingsRow.projectId,
        scanId,
        runId,
        promptIds: [...promptIds],
      });
    }

    const zdrPolicy = yield* resolveScanZdrPolicy(organizationId, settings, {
      projectId: settingsRow.projectId,
      scanId,
    });
    const scanEngines = scopeGeoScanEngines(
      catalog,
      settings.engines,
      requestedEngines
    );
    const trackedEngines: { engine: string; zdr: GeoZdrMode }[] = [];
    for (const engine of new Set(scanEngines)) {
      const zdr = resolveGeoZdrMode(catalog, engine, zdrPolicy);
      if (zdr === null) {
        yield* geoLogWarn({
          event: "geo.scan.skipped",
          reason: "zdr",
          organizationId,
          projectId: settingsRow.projectId,
          scanId,
          engine,
        });
        continue;
      }
      trackedEngines.push({ engine, zdr });
    }
    const sourceLanguage = settings.promptLanguage;
    const scanSourceLanguage = settings.languages.includes(sourceLanguage);
    const scanEnglish = settings.languages.includes(DEFAULT_LANGUAGE);
    const groundedEngines: { grounded: GeoGroundedEngine; zdr: GeoZdrMode }[] =
      [];
    const groundedRoutes = resolveGroundedEngines(scanEngines, catalog);
    for (const grounded of groundedRoutes) {
      const zdr = resolveGeoGroundedZdrMode(catalog, grounded, zdrPolicy);
      if (zdr === null) {
        yield* geoLogWarn({
          event: "geo.scan.skipped",
          reason: "zdr",
          organizationId,
          projectId: settingsRow.projectId,
          scanId,
          engine: grounded.key,
        });
        continue;
      }
      groundedEngines.push({ grounded, zdr });
    }
    const searchModels = new Set(
      groundedRoutes.map((grounded) => engineModelOf(grounded.key))
    );
    const rawEngines = trackedEngines.filter(
      ({ engine }) => !searchModels.has(engine)
    );
    const tasks: GeoScanPlannedTask[] = [];
    if (scanSourceLanguage) {
      for (const { engine, zdr } of rawEngines) {
        for (const prompt of prompts) {
          tasks.push({
            engine,
            groundedKey: null,
            prompt,
            language: sourceLanguage,
            zdr,
          });
        }
      }
    }
    const skipReason = geoScanEmptyEngineSkipReason(
      scanEngines,
      rawEngines.length + groundedEngines.length,
      requestedEngines
    );
    if (skipReason) {
      yield* geoLogWarn({
        event: "geo.scan.skipped",
        reason: skipReason,
        organizationId,
        projectId: settingsRow.projectId,
        scanId,
        runId,
        ...(requestedEngines ? { engines: [...requestedEngines] } : {}),
      });
      return skippedPlan(skipReason);
    }
    const groundedPrompts = scanSourceLanguage ? prompts : [];
    for (const { grounded, zdr } of groundedEngines) {
      for (const prompt of groundedPrompts) {
        tasks.push({
          engine: grounded.key,
          groundedKey: grounded.key,
          prompt,
          language: sourceLanguage,
          zdr,
        });
      }
    }

    let translateUsage = EMPTY_TOKEN_USAGE;
    const localizedByLanguage = yield* syncGeoPromptTranslations(
      {
        organizationId,
        projectId: settingsRow.projectId,
        languages: settings.languages,
        promptLanguage: sourceLanguage,
        prompts: allPrompts,
      },
      {
        promptIds: promptIds
          ? new Set(prompts.map((prompt) => prompt.id))
          : undefined,
        skipFields: {
          organizationId,
          projectId: settingsRow.projectId,
          scanId,
          runId,
        },
      }
    ).pipe(
      Effect.mapError(
        (cause) =>
          new GeoScanError({
            message: "Failed to load prompt translations",
            cause,
          })
      )
    );
    for (const entry of localizedByLanguage) {
      const { language, prompts: localized } = entry;
      if (entry.usage) {
        translateUsage = addTokenUsage(translateUsage, entry.usage);
      }
      for (const { engine, zdr } of rawEngines) {
        for (const prompt of localized) {
          tasks.push({ engine, groundedKey: null, prompt, language, zdr });
        }
      }
      for (const { grounded, zdr } of groundedEngines) {
        for (const prompt of localized) {
          tasks.push({
            engine: grounded.key,
            groundedKey: grounded.key,
            prompt,
            language,
            zdr,
          });
        }
      }
    }

    const sequenceRows =
      promptIds && scopedSequenceIds.length === 0
        ? []
        : yield* Effect.tryPromise({
            try: () =>
              db.query.geoPromptSequences.findMany({
                columns: { id: true, steps: true },
                where: and(
                  eq(geoPromptSequences.projectId, settingsRow.projectId),
                  scopedSequenceIds.length > 0
                    ? inArray(geoPromptSequences.id, scopedSequenceIds)
                    : eq(geoPromptSequences.enabled, true)
                ),
                orderBy: [asc(geoPromptSequences.createdAt)],
                limit: GEO_MAX_SEQUENCES,
              }),
            catch: (cause) =>
              new GeoScanError({
                message: "Failed to load GEO sequences",
                cause,
              }),
          });
    const trackedCodingAgents = trackedEngines.filter(
      ({ engine }) =>
        engine === GEO_OPENCODE_ENGINE_ID || isGeoBoxCodingAgent(engine)
    );
    const consumerEngines = rawEngines.filter(({ engine }) =>
      isGeoConsumerConversationEngine(engine)
    );
    const sequences: GeoScanPlannedSequence[] =
      scanSourceLanguage || scopedSequenceIds.length > 0
        ? sequenceRows.flatMap((sequence) => [
            ...groundedEngines.map(({ grounded, zdr }) => ({
              sequenceId: sequence.id,
              steps: sequence.steps,
              language: sourceLanguage,
              engine: grounded.key,
              groundedKey: grounded.key,
              zdr,
            })),
            ...consumerEngines.map(({ engine, zdr }) => ({
              sequenceId: sequence.id,
              steps: sequence.steps,
              language: sourceLanguage,
              engine,
              groundedKey: null,
              zdr,
            })),
            ...trackedCodingAgents.map((tracked) => ({
              sequenceId: sequence.id,
              steps: sequence.steps,
              language: sourceLanguage,
              engine: tracked.engine,
              groundedKey: null,
              zdr: tracked.zdr,
            })),
          ])
        : [];

    const personaRows =
      promptIds && scopedPersonaIds.length === 0
        ? []
        : yield* Effect.tryPromise({
            try: () =>
              db.query.geoPersonas.findMany({
                with: {
                  memories: {
                    orderBy: [
                      asc(geoPersonaMemories.createdAt),
                      asc(geoPersonaMemories.id),
                    ],
                  },
                },
                where: and(
                  eq(geoPersonas.projectId, settingsRow.projectId),
                  scopedPersonaIds.length > 0
                    ? inArray(geoPersonas.id, scopedPersonaIds)
                    : eq(geoPersonas.enabled, true),
                  isNull(geoPersonas.archivedAt)
                ),
                orderBy: [asc(geoPersonas.createdAt)],
                limit: GEO_PERSONA_MAX_COUNT,
              }),
            catch: (cause) =>
              new GeoScanError({
                message: "Failed to load GEO personas",
                cause,
              }),
          });
    const personas: GeoScanPlannedPersona[] =
      scanEnglish || scopedPersonaIds.length > 0
        ? personaRows.flatMap((persona) => {
            const snapshot = createPersonaSnapshot(
              persona,
              persona.memories,
              persona.conversationPrompts.slice(0, GEO_PERSONA_MAX_TURNS)
            );
            return snapshot.conversationPrompts.length > 0
              ? [
                  ...groundedEngines.map(({ grounded, zdr }) => ({
                    personaId: persona.id,
                    prompts: snapshot.conversationPrompts,
                    snapshot,
                    engine: grounded.key,
                    groundedKey: grounded.key,
                    zdr,
                  })),
                  ...consumerEngines.map(({ engine, zdr }) => ({
                    personaId: persona.id,
                    prompts: snapshot.conversationPrompts,
                    snapshot,
                    engine,
                    groundedKey: null,
                    zdr,
                  })),
                ]
              : [];
          })
        : [];

    const engines = [
      ...rawEngines.map((entry) => entry.engine),
      ...groundedEngines.map((entry) => entry.grounded.key),
    ];
    yield* geoLogInfo({
      event: "geo.scan.started",
      organizationId,
      projectId: settingsRow.projectId,
      scanId,
      runId,
      engines,
      enforceZdr: zdrPolicy.enforceZdr,
      zdrModes: Object.fromEntries([
        ...rawEngines.map((entry) => [entry.engine, entry.zdr]),
        ...groundedEngines.map((entry) => [entry.grounded.key, entry.zdr]),
      ]),
      promptCount: prompts.length,
      languages: settings.languages,
      tasks: tasks.length,
      personas: personas.length,
    });

    let answerBudget =
      gate.mode === "plan_quota" && gate.balanceRemaining != null
        ? gate.balanceRemaining
        : Number.POSITIVE_INFINITY;
    const withinAnswerBudget = <T>(items: T[], answers: (item: T) => number) =>
      items.filter((item) => {
        const cost = answers(item);
        if (cost > answerBudget) {
          return false;
        }
        answerBudget -= cost;
        return true;
      });
    const plannedTasks = withinAnswerBudget(
      interleaveGeoScanItemsByKey(tasks, (task) => task.engine),
      () => 1
    );
    const plannedSequences = withinAnswerBudget(sequences, (sequence) =>
      Math.min(sequence.steps.length, GEO_SEQUENCE_MAX_TURNS)
    );
    const plannedPersonas = withinAnswerBudget(
      personas,
      (persona) => persona.prompts.length * GEO_PERSONA_BILLING_MULTIPLIER
    );
    const plan: GeoScanProjectPlan = {
      context: {
        organizationId,
        projectId: settingsRow.projectId,
        scanId,
        runId,
        companyName: settings.companyName,
        aliases: settings.aliases,
        companyDescription: brand?.companyDescription ?? null,
        websiteUrl: brand?.websiteUrl ?? null,
        domains: settings.domains,
        gate,
        startedAtMs: Date.now(),
        scoped:
          promptIds !== undefined ||
          isPartialGeoScanEngineScope(settings.engines, scanEngines),
      },
      claimedAt: claimedAt.toISOString(),
      tasks: plannedTasks,
      sequences: plannedSequences,
      personas: plannedPersonas,
      promptCount: prompts.length,
      languages: settings.languages,
      engines,
      usage: translateUsage,
    };
    const planned: GeoScanProjectPlanResult = { status: "planned", plan };
    const planSnapshot = geoScanPlanSnapshot(plan);
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(geoScans)
          .set({
            plan: planSnapshot,
            planSummary: geoScanPlanSummary(planSnapshot),
          })
          .where(
            and(
              eq(geoScans.id, scanId),
              eq(geoScans.organizationId, organizationId),
              eq(geoScans.projectId, settingsRow.projectId),
              eq(geoScans.status, "running")
            )
          ),
      catch: (cause) =>
        new GeoScanError({ message: "Failed to store scan plan", cause }),
    });
    return planned;
  }
);

/**
 * Runs one batch of planned checks, persisting its rows before returning so a
 * later failure can only ever lose the batch in flight. Sized via
 * `GEO_SCAN_TASK_BATCH_SIZE` to fit comfortably inside one function
 * invocation — the whole scan used to run in a single step and was killed by
 * the platform's function timeout as soon as an organization tracked enough
 * engines.
 */
export const runGeoScanTaskBatch = Effect.fn("geo.runScanTaskBatch")(function* (
  context: GeoScanProjectContext,
  plannedTasks: readonly GeoScanPlannedTask[]
) {
  return yield* withGeoScanStep(
    context,
    "task_batch",
    runGeoScanTaskBatchBody(context, plannedTasks),
    batchUsageOf
  );
});

const runGeoScanTaskBatchBody = Effect.fn("geo.runScanTaskBatch.body")(
  function* (
    context: GeoScanProjectContext,
    plannedTasks: readonly GeoScanPlannedTask[]
  ) {
    const checkContext = yield* buildGeoScanCheckContext(context);

    const tasks: GeoCheckTask[] = [];
    let unavailableGrounded = 0;
    for (const planned of plannedTasks) {
      if (!planned.groundedKey) {
        tasks.push({ ...planned, grounded: null });
        continue;
      }
      const grounded = resolveGroundedEngineByKey(planned.groundedKey);
      if (!grounded) {
        unavailableGrounded += 1;
        yield* updateGeoScanTaskStatus(context, planned, "failed");
        yield* geoLogWarn({
          event: "geo.check.failed",
          organizationId: context.organizationId,
          projectId: context.projectId,
          scanId: context.scanId,
          engine: planned.engine,
          runId: context.runId,
          promptId: planned.prompt.id,
          language: planned.language,
          grounded: true,
          detail: "grounded engine unavailable",
        });
        continue;
      }
      tasks.push({ ...planned, grounded });
    }

    const results = yield* Effect.forEach(
      tasks,
      (task) => {
        const fields = checkFailureFields(checkContext, task);
        let failedAttemptUsage = EMPTY_TOKEN_USAGE;
        return updateGeoScanTaskStatus(context, task, "running").pipe(
          Effect.andThen(
            withGeoScanEvent(
              runGeoCheck(checkContext, task),
              {
                ...fields,
                event: "geo.check.attempt.completed",
              },
              {
                scanId: context.scanId,
                runId: context.runId,
                step: "check",
                engine: task.engine,
                taskKey: geoScanAnswerKey(
                  task.prompt.id,
                  task.engine,
                  task.language
                ),
                persistSuccess: false,
              }
            ).pipe(
              Effect.tapError((error) =>
                (error._tag === "GeoScanError" ||
                  error._tag === "GeoJudgeError") &&
                error.timedOut === true
                  ? geoLogWarn({
                      ...fields,
                      event: "geo.check.timeout",
                      detail: error.message,
                    })
                  : Effect.void
              ),
              Effect.tapError((error) =>
                Effect.sync(() => {
                  if (error._tag === "GeoScanError" && error.usage) {
                    failedAttemptUsage = addTokenUsage(
                      failedAttemptUsage,
                      error.usage
                    );
                  }
                })
              ),
              Effect.retry({
                times: 1,
                while: (error) =>
                  // Re-running a Context check submits another paid consumer prompt.
                  !isGeoContextEngine(task.engine) &&
                  error._tag === "GeoScanError" &&
                  error.timedOut === true,
              }),
              Effect.catchTag("GeoEmptyAnswerError", (error) =>
                Effect.sync(() => droppedCheckOutcome(fields, error))
              ),
              Effect.catchTag("GeoJudgeError", (error) =>
                Effect.sync(() => droppedCheckOutcome(fields, error))
              ),
              Effect.catchTag("GeoScanError", (error) =>
                Effect.sync(() =>
                  droppedCheckOutcome(
                    fields,
                    new GeoScanError({
                      message: error.message,
                      cause: error.cause,
                      timedOut: error.timedOut,
                    })
                  )
                )
              ),
              geoSkip("check failed", fields),
              Effect.map((result): GeoCheckOutcome | null =>
                result
                  ? {
                      ...result,
                      engineUsage: addTokenUsage(
                        result.engineUsage ?? EMPTY_TOKEN_USAGE,
                        failedAttemptUsage
                      ),
                      usage: addTokenUsage(result.usage, failedAttemptUsage),
                    }
                  : result
              ),
              Effect.tap((result) =>
                result?.row
                  ? Effect.void
                  : updateGeoScanTaskStatus(context, task, "failed")
              )
            )
          )
        );
      },
      { concurrency: GEO_SCAN_CONCURRENCY }
    );
    const persistedRows = results.map((result) => result?.row ?? null);

    for (const summary of summarizeGeoEngineAttempts(tasks, persistedRows)) {
      if (summary.attempted === 0 || summary.failed < summary.attempted) {
        continue;
      }
      yield* geoLogError({
        event: "geo.scan.engine_dropped",
        organizationId: context.organizationId,
        projectId: context.projectId,
        scanId: context.scanId,
        engine: summary.engine,
        runId: context.runId,
        attempted: summary.attempted,
        failed: summary.failed,
      });
    }

    const checkOutcomes = results.filter(
      (result): result is GeoCheckOutcome => result !== null
    );
    const rows = persistedRows.filter(
      (row): row is GeoCheckWrite => row !== null
    );
    let engineUsage = EMPTY_TOKEN_USAGE;
    let judgeUsage = EMPTY_TOKEN_USAGE;
    for (const outcome of checkOutcomes) {
      engineUsage = addTokenUsage(
        engineUsage,
        outcome.engineUsage ?? EMPTY_TOKEN_USAGE
      );
      judgeUsage = addTokenUsage(
        judgeUsage,
        outcome.judgeUsage ?? EMPTY_TOKEN_USAGE
      );
    }

    if (rows.length > 0) {
      yield* Effect.tryPromise({
        try: () => insertGeoMentionChecks(rows),
        catch: (cause) =>
          new GeoScanError({ message: "Failed to store GEO checks", cause }),
      });
    }

    const outcome: GeoScanBatchOutcome = {
      checks: rows.length,
      mentions: rows.filter((row) => row.mentioned).length,
      dropped: plannedTasks.length - rows.length,
      usage: addTokenUsage(engineUsage, judgeUsage),
      engineUsage,
      judgeUsage,
    };
    return outcome;
  }
);

/** Runs one batch of conversation sequences; same contract as `runGeoScanTaskBatch`. */
export const runGeoScanSequenceBatch = Effect.fn("geo.runScanSequenceBatch")(
  function* (
    context: GeoScanProjectContext,
    plannedSequences: readonly GeoScanPlannedSequence[]
  ) {
    return yield* withGeoScanStep(
      context,
      "sequence_batch",
      runGeoScanSequenceBatchBody(context, plannedSequences),
      batchUsageOf
    );
  }
);

const runGeoScanSequenceBatchBody = Effect.fn("geo.runScanSequenceBatch.body")(
  function* (
    context: GeoScanProjectContext,
    plannedSequences: readonly GeoScanPlannedSequence[]
  ) {
    const checkContext = yield* buildGeoScanCheckContext(context);

    const outcomes = yield* Effect.forEach(
      plannedSequences,
      (planned) =>
        Effect.gen(function* () {
          const sequence: GeoSequenceDefinition = {
            id: planned.sequenceId,
            steps: planned.steps,
            language: planned.language ?? DEFAULT_LANGUAGE,
          };
          for (const task of geoScanSequenceTasks(planned)) {
            yield* updateGeoScanAnswerStatus(context, task, "running");
          }
          const grounded = resolveGeoConversationEngine(planned);
          if (planned.groundedKey && !grounded) {
            return { sequence, result: null };
          }
          const engine = grounded ? grounded.key : planned.engine;
          const fields = sequenceFailureFields(
            checkContext,
            sequence,
            engine,
            Boolean(grounded)
          );
          const check = grounded
            ? runGeoSequenceCheck(checkContext, sequence, grounded, planned.zdr)
            : runGeoOpenCodeSequenceCheck(
                checkContext,
                sequence,
                planned.engine,
                planned.zdr
              );
          return yield* withGeoScanEvent(
            check,
            { ...fields, event: "geo.check.attempt.completed" },
            {
              scanId: context.scanId,
              runId: context.runId,
              step: "check",
              engine,
              taskKey: planned.sequenceId,
              persistSuccess: false,
            }
          ).pipe(
            geoSkip("sequence failed", fields),
            Effect.map((result) => ({ sequence, result }))
          );
        }).pipe(
          Effect.tap(({ result }) =>
            Effect.forEach(
              geoScanSequenceTasks(planned).filter(
                (task) => !result?.rows.some((row) => row.turn === task.turn)
              ),
              (task) => updateGeoScanAnswerStatus(context, task, "failed"),
              { discard: true }
            )
          )
        ),
      { concurrency: GEO_SCAN_CONCURRENCY }
    );

    const rows: GeoCheckWrite[] = [];
    let dropped = 0;
    let engineUsage = EMPTY_TOKEN_USAGE;
    let judgeUsage = EMPTY_TOKEN_USAGE;
    for (const { sequence, result } of outcomes) {
      if (!result) {
        dropped += sequenceTurnCount(sequence);
        continue;
      }
      dropped += result.droppedTurns;
      rows.push(...result.rows);
      engineUsage = addTokenUsage(
        engineUsage,
        result.engineUsage ?? EMPTY_TOKEN_USAGE
      );
      judgeUsage = addTokenUsage(
        judgeUsage,
        result.judgeUsage ?? EMPTY_TOKEN_USAGE
      );
    }
    if (rows.length > 0) {
      yield* Effect.tryPromise({
        try: () => insertGeoMentionChecks(rows),
        catch: (cause) =>
          new GeoScanError({ message: "Failed to store GEO checks", cause }),
      });
    }

    const outcome: GeoScanBatchOutcome = {
      checks: rows.length,
      mentions: rows.filter((row) => row.mentioned).length,
      dropped,
      usage: addTokenUsage(engineUsage, judgeUsage),
      engineUsage,
      judgeUsage,
    };
    return outcome;
  }
);

/**
 * Ends one project scan: settles the billing reservation, writes the
 * `geo_scans` verdict, and ends the slot claim. Runs on both outcomes so a
 * failed run never leaves a row on "running" or a reservation held.
 */
export const finalizeGeoScanProject = Effect.fn("geo.finalizeScanProject")(
  function* (
    context: GeoScanProjectContext,
    totals: GeoScanProjectTotals,
    status: "completed" | "failed",
    claimToken: string,
    failure?: GeoScanFailureMetadata
  ) {
    return yield* withGeoScanStep(
      context,
      "finalize",
      finalizeGeoScanProjectBody(context, totals, status, claimToken, failure),
      () =>
        snapshotUsageByRole(
          totals.engineUsage ?? totals.usage,
          totals.judgeUsage ?? EMPTY_TOKEN_USAGE
        )
    );
  }
);

const finalizeGeoScanProjectBody = Effect.fn("geo.finalizeScanProject.body")(
  function* (
    context: GeoScanProjectContext,
    totals: GeoScanProjectTotals,
    status: "completed" | "failed",
    claimToken: string,
    failure?: GeoScanFailureMetadata
  ) {
    const billing = yield* GeoContentBillingService;
    const claimedAt = yield* parseGeoClaimToken(claimToken).pipe(
      geoSkip("scan claim token invalid")
    );

    if (totals.checks > 0) {
      yield* billing
        .finalizeContentBilling({
          reservation: context.gate,
          action: "confirm",
          units: totals.billedChecks ?? totals.checks,
          usage: totals.billedUsage ?? totals.usage,
          fallbackModelId: GEO_JUDGE_MODEL,
          properties: {
            source: "geo_scan",
            run_id: context.runId,
            project_id: context.projectId,
            markup_applied: context.gate.useMarkup,
            status,
          },
          logPrefix: "GeoScan",
        })
        .pipe(
          Effect.catch((confirmError) =>
            Effect.sync(() => {
              logGeoBillingFailure(
                "confirm",
                context.projectId,
                context.runId,
                confirmError
              );
            })
          )
        );
    } else {
      yield* releaseGeoScanBilling(
        billing,
        context.gate,
        context.projectId,
        context.runId
      );
    }

    yield* finishGeoScanRow(
      { organizationId: context.organizationId, projectId: context.projectId },
      context.scanId,
      status,
      failure,
      {
        runId: context.runId,
        inputTokens: totals.usage.inputTokens,
        outputTokens: totals.usage.outputTokens,
        cacheReadTokens: totals.usage.cacheReadTokens,
        cacheWriteTokens: totals.usage.cacheWriteTokens,
        reasoningTokens: totals.usage.reasoningTokens ?? 0,
        totalUsd: totals.usage.totalUsd ?? 0,
        checksTotal: totals.checks + totals.dropped,
        checksFailed: totals.dropped,
        mentions: totals.mentions,
        durationMs: Date.now() - context.startedAtMs,
        usageByRole: snapshotUsageByRole(
          totals.engineUsage ?? totals.usage,
          totals.judgeUsage ?? EMPTY_TOKEN_USAGE
        ),
      }
    ).pipe(
      geoSkip("scan row finish failed", {
        event: "geo.scan.stamp_failed",
        organizationId: context.organizationId,
        projectId: context.projectId,
        scanId: context.scanId,
        runId: context.runId,
        stamp: status,
      })
    );

    if (claimedAt) {
      const endClaim =
        status === "completed" && !context.scoped
          ? markGeoScanFinished(context.projectId, claimedAt).pipe(
              geoSkip("scan finish stamp failed", {
                event: "geo.scan.stamp_failed",
                organizationId: context.organizationId,
                projectId: context.projectId,
                scanId: context.scanId,
                runId: context.runId,
                stamp: "finished",
              })
            )
          : releaseGeoScanRun(context.projectId, claimedAt).pipe(
              geoSkip("scan claim release failed")
            );
      yield* endClaim;
    }

    yield* geoLogInfo({
      event: "geo.scan.finished",
      status,
      organizationId: context.organizationId,
      projectId: context.projectId,
      scanId: context.scanId,
      runId: context.runId,
      checks: totals.checks,
      mentions: totals.mentions,
      droppedChecks: totals.dropped,
      usage: totals.usage,
      durationMs: Date.now() - context.startedAtMs,
    });
    yield* flushGeoLogEffect;
  }
);

const runGeoSequenceCheck = Effect.fn("geo.runSequenceCheck")(function* (
  context: GeoCheckContext,
  sequence: GeoSequenceDefinition,
  grounded: GeoConversationEngine,
  zdr: GeoZdrMode
) {
  return yield* runGeoConversation(
    context,
    {
      promptId: sequencePromptId(sequence.id),
      sequenceId: sequence.id,
      prompts: sequence.steps.slice(0, GEO_SEQUENCE_MAX_TURNS),
      language: sequence.language,
      timeoutMs: GEO_SEQUENCE_PAIR_TIMEOUT_MS,
    },
    grounded,
    zdr
  );
});

const runGeoOpenCodeSequenceCheck = Effect.fn("geo.runOpenCodeSequenceCheck")(
  function* (
    context: GeoCheckContext,
    sequence: GeoSequenceDefinition,
    engine: string,
    zdr: GeoZdrMode
  ) {
    yield* requireGeoCodingAgentAccess(context.organizationId);
    const rows: GeoCheckWrite[] = [];
    const steps = sequence.steps.slice(0, GEO_SEQUENCE_MAX_TURNS);
    const deadlineAtMs = Date.now() + GEO_SEQUENCE_PAIR_TIMEOUT_MS;
    const boxAgent = geoBoxAgentForEngine(engine);
    const boxModel = boxAgent?.model ?? GEO_OPENCODE_BOX_MODEL_ID;
    const timeoutMessage = `Sequence ${sequence.id} on ${engine} timed out after ${GEO_SEQUENCE_PAIR_TIMEOUT_MS}ms`;
    const failureFields = sequenceFailureFields(
      context,
      sequence,
      engine,
      false
    );
    let conversationPromise: ReturnType<
      typeof askGeoOpenCodeConversation
    > | null = null;
    const completedResults: Awaited<
      ReturnType<typeof askGeoOpenCodeConversation>
    > = [];
    let reportedUsage: GeoBoxAnswer["usage"] | undefined;
    const results = yield* Effect.tryPromise({
      try: (signal) => {
        conversationPromise = askGeoOpenCodeConversation(
          steps.map(
            (step) =>
              `${GEO_OPENCODE_ANSWER_SYSTEM_PROMPT}\n\nUser question:\n${step}`
          ),
          signal,
          deadlineAtMs,
          boxModel,
          boxAgent?.harness,
          (result) => {
            completedResults.push(result);
            reportedUsage = undefined;
          },
          (usage) => {
            reportedUsage = usage;
          }
        );
        return conversationPromise;
      },
      catch: (cause) =>
        new GeoScanError({
          message: `Engine ${engine} failed to answer the conversation`,
          cause,
        }),
    }).pipe(
      Effect.ensuring(awaitBoxSettled(() => conversationPromise)),
      Effect.timeoutOrElse({
        duration: Math.max(1, deadlineAtMs - Date.now()),
        orElse: () =>
          Effect.fail(
            new GeoScanError({
              message: timeoutMessage,
              timedOut: true,
            })
          ),
      }),
      Effect.catchTag("GeoScanError", (error) => {
        if (completedResults.length === 0 && !reportedUsage) {
          return Effect.fail(error);
        }
        return Effect.sync(() => {
          logGeoSkip("native conversation incomplete", failureFields, error);
          return completedResults;
        });
      })
    );
    const engineUsage = results.reduce(
      (total, result) => addTokenUsage(total, result.usage),
      reportedUsage
        ? addTokenUsage(EMPTY_TOKEN_USAGE, reportedUsage)
        : EMPTY_TOKEN_USAGE
    );
    let judgeUsage = EMPTY_TOKEN_USAGE;
    let droppedTurns = 0;

    for (const [index, step] of steps.entries()) {
      const result = results[index];
      if (!result) {
        droppedTurns = steps.length - index;
        break;
      }
      const answer = toBoxEngineAnswer(result);
      if (zdr !== "none") {
        yield* geoLogWarn({
          ...failureFields,
          event: "geo.check.zdr_relaxed",
          turn: index,
          zdr,
        });
      }
      const turnStartedMs = performance.now();
      const answerText = yield* requireAnswerText(
        engine,
        sequencePromptId(sequence.id),
        sequence.language,
        answer
      ).pipe(
        Effect.catchTag("GeoEmptyAnswerError", (error) =>
          Effect.sync(() => {
            logGeoSkip(
              "sequence turn failed",
              { ...failureFields, turn: index + 1 },
              error
            );
            return null;
          })
        )
      );
      if (answerText === null) {
        droppedTurns = steps.length - index;
        break;
      }
      const judgeTimeoutMs = deadlineAtMs - Date.now();
      if (judgeTimeoutMs <= 0) {
        logGeoSkip(
          "sequence turn failed",
          { ...failureFields, turn: index + 1 },
          new GeoScanError({
            message: timeoutMessage,
            timedOut: true,
          })
        );
        droppedTurns = steps.length - index;
        break;
      }
      const judged = yield* judgeAnswer(context, step, answerText, {
        promptId: sequencePromptId(sequence.id),
        turn: index + 1,
      }).pipe(
        Effect.timeoutOrElse({
          duration: judgeTimeoutMs,
          orElse: () =>
            Effect.fail(
              new GeoJudgeError({
                message: timeoutMessage,
                timedOut: true,
                cause: undefined,
              })
            ),
        }),
        Effect.catchTag("GeoJudgeError", (error) =>
          Effect.sync(() => {
            logGeoSkip(
              "sequence turn failed",
              { ...failureFields, turn: index + 1 },
              error
            );
            return null;
          })
        )
      );
      if (judged === null) {
        droppedTurns = steps.length - index;
        break;
      }
      judgeUsage = addTokenUsage(judgeUsage, agentTokenUsageFrom(judged.usage));
      const ownedSourceCited = hasOwnedSourceCitation(
        context.websiteUrl,
        answer.sources,
        context.domains
      );

      rows.push({
        organizationId: context.organizationId,
        projectId: context.projectId,
        scanId: context.scanId,
        engine,
        promptId: sequencePromptId(sequence.id),
        sequenceId: sequence.id,
        turn: index + 1,
        prompt: step,
        answer: answerText,
        capturedAt: context.capturedAt,
        mentioned: judged.mentioned,
        ownedSourceCited,
        position: normalizePosition(judged.position),
        sentiment: judged.sentiment,
        competitors: judged.competitors.slice(0, MAX_JUDGE_COMPETITORS),
        excerpt: judged.excerpt.slice(0, GEO_EXCERPT_MAX_LENGTH),
        grounding: answer.grounding,
        finishReason: answer.finishReason,
        ...geoCheckWriteUsage(
          answer.usage,
          judged.usage,
          Math.round(
            (answer.usage?.computeMs ?? 0) + (performance.now() - turnStartedMs)
          )
        ),
        zdrEnforced: answer.zdrEnforced,
        language: sequence.language,
        sources: answer.sources,
        surfaces: answer.surfaces ?? null,
      });
    }

    const outcome: GeoSequenceCheckOutcome = {
      rows,
      usage: addTokenUsage(engineUsage, judgeUsage),
      engineUsage,
      judgeUsage,
      droppedTurns,
    };
    return outcome;
  }
);

/**
 * Plays a single conversation against every available replay engine right
 * away, outside the scheduled scan. The run is recorded as a regular
 * `geo_scans` row so its checks show up alongside scan results, and it is
 * charged against the organization's AI credits. Consumer-app engines go to
 * a scan scoped to this conversation instead.
 */
const runGeoSequenceNowProgram = Effect.fn("geo.runSequenceNow")(function* (
  input: GeoScopeInput,
  sequenceId: string
) {
  const scope = yield* requireGeoProject(input);
  const projectId = scope.projectId;

  const sequenceRow = yield* Effect.tryPromise({
    try: () =>
      db.query.geoPromptSequences.findFirst({
        columns: { id: true, steps: true },
        where: and(
          eq(geoPromptSequences.id, sequenceId),
          eq(geoPromptSequences.projectId, projectId)
        ),
      }),
    catch: (cause) =>
      new GeoSequenceRunError({
        message: "Failed to load the conversation",
        cause,
      }),
  });
  if (!sequenceRow) {
    return yield* Effect.fail(new GeoSequenceNotFoundError({ sequenceId }));
  }

  const settingsRow = yield* Effect.tryPromise({
    try: () =>
      db.query.geoSettings.findFirst({
        where: eq(geoSettings.projectId, projectId),
      }),
    catch: (cause) =>
      new GeoSequenceRunError({
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
  const brand = yield* loadGeoProjectBrand({
    organizationId: scope.organizationId,
    projectId,
  });
  const zdrPolicy = yield* resolveScanZdrPolicy(
    scope.organizationId,
    settings,
    { projectId, sequenceId }
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
        sequenceId,
        engine: grounded.key,
      });
      continue;
    }
    groundedEngines.push({ grounded, zdr });
  }
  const boxReplayEngines: { engine: string; zdr: GeoZdrMode }[] = [];
  for (const engineId of GEO_CODING_AGENT_ENGINE_IDS) {
    if (
      !settings.engines.includes(engineId) ||
      !catalog.models.some((model) => model.id === engineId)
    ) {
      continue;
    }
    const zdr = resolveGeoZdrMode(catalog, engineId, zdrPolicy);
    if (zdr === null) {
      yield* geoLogWarn({
        event: "geo.scan.skipped",
        reason: "zdr",
        organizationId: scope.organizationId,
        projectId,
        sequenceId,
        engine: engineId,
      });
      continue;
    }
    boxReplayEngines.push({ engine: engineId, zdr });
  }
  const replayEngines = [
    ...groundedEngines.map((pair) => ({
      kind: "grounded" as const,
      id: pair.grounded.key,
      ...pair,
    })),
    ...boxReplayEngines.map((pair) => ({
      kind: "box" as const,
      id: pair.engine,
      ...pair,
    })),
  ];
  const skipFields = {
    organizationId: scope.organizationId,
    projectId,
    sequenceId,
  };
  const olostepEngines = yield* resolveGeoManualOlostepEngines(
    catalog,
    settings.engines,
    zdrPolicy,
    skipFields
  );
  if (replayEngines.length === 0 && olostepEngines.length === 0) {
    return yield* Effect.fail(new GeoSequenceRunUnavailableError({}));
  }
  const queued = yield* queueGeoOlostepConversationScan(
    input,
    sequencePromptId(sequenceId),
    olostepEngines,
    skipFields,
    replayEngines.length === 0
  );
  if (replayEngines.length === 0) {
    const response: GeoSequenceRunResponse = {
      checks: 0,
      mentions: 0,
      engines: [],
      queuedScanId: queued?.scanId ?? null,
      queuedEngines: olostepEngines,
    };
    return response;
  }

  const runId = `geo-sequence-${sequenceId}-${crypto.randomUUID()}`;
  const result = yield* runGeoConversationReplay(
    {
      context: {
        organizationId: scope.organizationId,
        projectId,
        runId,
        catalog,
        companyName: settings.companyName,
        aliases: settings.aliases,
        companyDescription: brand?.companyDescription ?? null,
        websiteUrl: brand?.websiteUrl ?? null,
        domains: settings.domains,
      },
      fallbackModelId:
        groundedEngines[0]?.grounded.model ??
        geoBoxAgentForEngine(boxReplayEngines[0]?.engine ?? "")?.model ??
        GEO_JUDGE_MODEL,
      properties: { source: "geo_sequence_run", sequence_id: sequenceId },
      logPrefix: "GeoSequenceRun",
      emptyMessage: "Engines failed to answer this conversation. Try again.",
    },
    (context) => {
      const sequence: GeoSequenceDefinition = {
        ...sequenceRow,
        language: settings.promptLanguage,
      };
      return Effect.forEach(
        replayEngines,
        (replayEngine) => {
          const grounded = replayEngine.kind === "grounded";
          const check = grounded
            ? runGeoSequenceCheck(
                context,
                sequence,
                replayEngine.grounded,
                replayEngine.zdr
              )
            : runGeoOpenCodeSequenceCheck(
                context,
                sequence,
                replayEngine.engine,
                replayEngine.zdr
              );
          return check.pipe(
            geoSkip(
              "sequence run failed",
              sequenceFailureFields(
                context,
                sequence,
                replayEngine.id,
                grounded
              )
            )
          );
        },
        { concurrency: GEO_SCAN_CONCURRENCY }
      );
    }
  ).pipe(
    // The consumer apps are already queued and billed on their own scan, so
    // the run still succeeds when no API engine answered.
    Effect.catchTag("GeoConversationNoAnswersError", (error) =>
      queued ? Effect.succeed(null) : Effect.fail(error)
    ),
    Effect.mapError((error) =>
      error._tag === "GeoWriterCreditsExhaustedError"
        ? error
        : new GeoSequenceRunError({ message: error.message, cause: error })
    )
  );

  const response: GeoSequenceRunResponse = {
    checks: result?.rows.length ?? 0,
    mentions: result?.rows.filter((row) => row.mentioned).length ?? 0,
    engines: result ? replayEngines.map((replayEngine) => replayEngine.id) : [],
    queuedScanId: queued?.scanId ?? null,
    queuedEngines: queued ? olostepEngines : [],
  };
  return response;
});

export function runGeoSequenceNow(input: GeoScopeInput, sequenceId: string) {
  return runGeoSequenceNowProgram(input, sequenceId).pipe(
    Effect.ensuring(flushGeoLogEffect)
  );
}
