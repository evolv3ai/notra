import {
  GEO_SCAN_BATCH_CONCURRENCY,
  GEO_SCAN_CLAIM_RENEW_AFTER_MS,
  GEO_SCAN_NO_RESULTS_RETRY_DELAY,
  GEO_SCAN_SEQUENCE_BATCH_SIZE,
  GEO_SCAN_TASK_BATCH_SIZE,
} from "@notra/geo-core/constants/geo";
import {
  GEO_OLOSTEP_MAX_WAIT_MS,
  GEO_OLOSTEP_POLL_INTERVAL,
  GEO_OLOSTEP_RESULT_GRACE_MS,
} from "@notra/geo-core/constants/geo-olostep";
import { GEO_SCAN_PERSONA_BATCH_SIZE } from "@notra/geo-core/constants/geo-personas";
import { geoScanWorkflowPayloadSchema } from "@notra/geo-core/schemas/geo-workflows";
import type {
  GeoScanBatchOutcome,
  GeoScanFailureMetadata,
  GeoScanProjectContext,
  GeoScanProjectPlan,
  GeoScanProjectTotals,
  GeoScanResult,
} from "@notra/geo-core/types/geo";
import type {
  GeoOlostepQuery,
  GeoOlostepResults,
} from "@notra/geo-core/types/geo-olostep";
import { isGeoOlostepEngine } from "@notra/geo-core/utils/geo-olostep";
import { missingGeoOlostepQueryIndexes } from "@notra/geo-core/utils/geo-olostep-batches";
import {
  applyGeoOlostepResults,
  buildGeoOlostepQueries,
} from "@notra/geo-core/utils/geo-olostep-plan";
import {
  classifyGeoScanExecutionFailure,
  chunkGeoScanItems,
  describeGeoScanFailure,
} from "@notra/geo-core/utils/geo-scan";
import {
  addAgentTokenUsage,
  EMPTY_AGENT_TOKEN_USAGE,
} from "@notra/geo-core/utils/token-usage";
import { FatalError, sleep } from "workflow";
import { flattenError } from "zod";

import type { GeoScanPayload } from "@/types/geo";
import type { LogRetentionDays } from "@/types/webhooks/webhooks";

import {
  appendAutomationLogBestEffort,
  fetchLogRetention,
} from "./steps/content-generation-steps";
import { evaluateGeoAlertsStep } from "./steps/geo-alert-steps";
import {
  collectGeoOlostepResultsStep,
  finalizeGeoScanProjectStep,
  listGeoScanProjectsStep,
  pendingGeoOlostepBatchesStep,
  prepareGeoScanProjectStep,
  renewGeoScanClaimStep,
  revokeFreeScanBalanceStep,
  runGeoScanPersonaBatchStep,
  runGeoScanSequenceBatchStep,
  runGeoScanTaskBatchStep,
  submitGeoOlostepBatchesStep,
  trackGeoScanRetryScheduledStep,
} from "./steps/geo-scan-steps";
import { refreshGeoContentGapsStep } from "./steps/refresh-geo-content-gaps";
import { startGeoSentimentStep } from "./steps/start-geo-sentiment";
import { syncGeoShelfCitationsStep } from "./steps/sync-geo-shelf-citations";

interface GeoScanProjectOutcome {
  totals: GeoScanProjectTotals;
  attempted: number;
  noSuccessfulChecks: boolean;
}

type GeoScanBatchRunner<T> = (
  context: GeoScanProjectContext,
  batch: T[]
) => Promise<GeoScanBatchOutcome>;

function addBatchOutcome(
  totals: GeoScanProjectTotals,
  outcome: GeoScanBatchOutcome
): void {
  totals.checks += outcome.checks;
  totals.mentions += outcome.mentions;
  totals.dropped += outcome.dropped;
  if (outcome.omitted) {
    totals.omitted = (totals.omitted ?? 0) + outcome.omitted;
  }
  const engine = outcome.engineUsage ?? EMPTY_AGENT_TOKEN_USAGE;
  const judge = outcome.judgeUsage ?? EMPTY_AGENT_TOKEN_USAGE;
  const batchEngineUsage =
    outcome.engineUsage || outcome.judgeUsage ? engine : outcome.usage;
  totals.engineUsage = addAgentTokenUsage(
    totals.engineUsage ?? EMPTY_AGENT_TOKEN_USAGE,
    batchEngineUsage
  );
  totals.billedChecks =
    (totals.billedChecks ?? 0) + (outcome.billedChecks ?? outcome.checks);
  totals.billedUsage = addAgentTokenUsage(
    totals.billedUsage ?? EMPTY_AGENT_TOKEN_USAGE,
    outcome.billedUsage ?? outcome.usage
  );
  totals.judgeUsage = addAgentTokenUsage(
    totals.judgeUsage ?? EMPTY_AGENT_TOKEN_USAGE,
    judge
  );
  totals.usage = addAgentTokenUsage(totals.engineUsage, totals.judgeUsage);
}

function isClaimRenewalDue(claimedAt: string, now: number): boolean {
  return now - Date.parse(claimedAt) >= GEO_SCAN_CLAIM_RENEW_AFTER_MS;
}

function nextClaimRenewalToken(claimedAt: string, now: number): string {
  return new Date(Math.max(now, Date.parse(claimedAt) + 1)).toISOString();
}

type GeoScanBatchSettlement =
  | { index: number; outcome: GeoScanBatchOutcome }
  | { index: number; error: unknown };

async function runGeoScanBatchWindow<T>(
  context: GeoScanProjectContext,
  items: readonly T[],
  batchSize: number,
  runBatch: GeoScanBatchRunner<T>,
  state: { claimedAt: string; totals: GeoScanProjectTotals }
): Promise<void> {
  const batches = chunkGeoScanItems(items, batchSize);
  const inFlight = new Map<number, Promise<GeoScanBatchSettlement>>();
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;

  const hasPendingBatches = () => !failed && nextIndex < batches.length;
  while (hasPendingBatches() || inFlight.size > 0) {
    while (hasPendingBatches() && inFlight.size < GEO_SCAN_BATCH_CONCURRENCY) {
      const now = Date.now();
      if (isClaimRenewalDue(state.claimedAt, now)) {
        try {
          // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each renewal depends on the previous claim token
          state.claimedAt = await renewGeoScanClaimStep(
            context.projectId,
            state.claimedAt,
            nextClaimRenewalToken(state.claimedAt, now)
          );
        } catch (error) {
          failed = true;
          failure = error;
          break;
        }
      }
      const index = nextIndex;
      nextIndex += 1;
      inFlight.set(
        index,
        runBatch(context, batches[index] ?? []).then(
          (outcome) => ({ index, outcome }),
          (error: unknown) => ({ index, error })
        )
      );
    }
    if (inFlight.size === 0) {
      break;
    }
    const settled = await Promise.race(inFlight.values());
    inFlight.delete(settled.index);
    if ("outcome" in settled) {
      addBatchOutcome(state.totals, settled.outcome);
    } else if (!failed) {
      failed = true;
      failure = settled.error;
    }
  }
  if (failed) {
    throw failure;
  }
}

function submitGeoOlostepRound(
  queries: GeoOlostepQuery[],
  indexes: number[]
): Promise<string[]> {
  return indexes.length > 0
    ? submitGeoOlostepBatchesStep(queries, indexes)
    : Promise.resolve([]);
}

/**
 * Retains completed items while polling. A terminal batch can still publish
 * late results, so missing items get a bounded grace period before retrying.
 */
async function awaitGeoOlostepRound(
  context: GeoScanProjectContext,
  queries: GeoOlostepQuery[],
  batchIds: string[],
  state: { claimedAt: string },
  initialResults: GeoOlostepResults = {}
): Promise<GeoOlostepResults> {
  if (batchIds.length === 0) {
    return initialResults;
  }
  const deadline = Date.now() + GEO_OLOSTEP_MAX_WAIT_MS;
  let settleUntil: number | undefined;
  let results = initialResults;
  for (;;) {
    const now = Date.now();
    if (isClaimRenewalDue(state.claimedAt, now)) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each renewal depends on the previous claim token
      state.claimedAt = await renewGeoScanClaimStep(
        context.projectId,
        state.claimedAt,
        nextClaimRenewalToken(state.claimedAt, now)
      );
    }
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each poll retains the result handles collected so far
    results = { ...results, ...(await collectGeoOlostepResultsStep(batchIds)) };
    if (missingGeoOlostepQueryIndexes(queries, results).length === 0) {
      return results;
    }

    if (settleUntil === undefined) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- polling waits on the previous status check
      const pending = await pendingGeoOlostepBatchesStep(batchIds);
      if (pending.length === 0 || Date.now() >= deadline) {
        settleUntil = Date.now() + GEO_OLOSTEP_RESULT_GRACE_MS;
      }
    }
    if (settleUntil !== undefined && Date.now() >= settleUntil) {
      return results;
    }
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- durable sleep between result checks
    await sleep(GEO_OLOSTEP_POLL_INTERVAL);
  }
}

/** Waits for the first round, then retries failed or unfinished items once. */
async function resolveGeoOlostepResults(
  context: GeoScanProjectContext,
  queries: GeoOlostepQuery[],
  firstBatchIds: string[],
  state: { claimedAt: string }
): Promise<GeoOlostepResults> {
  let first = await awaitGeoOlostepRound(
    context,
    queries,
    firstBatchIds,
    state
  );
  if (missingGeoOlostepQueryIndexes(queries, first).length === 0) {
    return first;
  }
  // Recheck immediately before a paid retry in case a result just arrived.
  if (firstBatchIds.length > 0) {
    first = {
      ...first,
      ...(await collectGeoOlostepResultsStep(firstBatchIds)),
    };
  }
  const missing = missingGeoOlostepQueryIndexes(queries, first);
  if (missing.length === 0) {
    return first;
  }
  const retryBatchIds = await submitGeoOlostepRound(queries, missing);
  const allBatchIds = [...firstBatchIds, ...retryBatchIds];
  const retry = await awaitGeoOlostepRound(
    context,
    queries,
    allBatchIds,
    state,
    first
  );
  // The original batches can recover even while the retry is being awaited.
  return allBatchIds.length > 0
    ? { ...retry, ...(await collectGeoOlostepResultsStep(allBatchIds)) }
    : retry;
}

async function finalizeProjectRun(
  plan: GeoScanProjectPlan,
  totals: GeoScanProjectTotals,
  status: "completed" | "failed",
  claimedAt: string,
  options: {
    retried: boolean;
    /** The workflow retries this project, so alerts wait for that attempt. */
    willRetry?: boolean;
    failureReason?: string;
    failure?: GeoScanFailureMetadata;
    retentionDays?: LogRetentionDays;
  }
): Promise<void> {
  await finalizeGeoScanProjectStep(plan.context, totals, status, claimedAt, {
    retried: options.retried,
    ...(options.failureReason ? { failureReason: options.failureReason } : {}),
    ...(options.failure ? { failure: options.failure } : {}),
  });
  const { context } = plan;
  const scope = {
    organizationId: context.organizationId,
    projectId: context.projectId,
  };
  const logFollowUpFailure = (
    title: string,
    error: unknown,
    payload?: Record<string, unknown>
  ) =>
    appendAutomationLogBestEffort({
      organizationId: context.organizationId,
      integrationId: context.projectId,
      integrationType: "geo",
      title,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      referenceId: context.runId,
      ...(payload ? { payload } : {}),
      ...(options.retentionDays
        ? { retentionDays: options.retentionDays }
        : {}),
    });
  if (totals.checks > 0) {
    try {
      await refreshGeoContentGapsStep(scope);
    } catch (error) {
      await logFollowUpFailure(
        `Content gaps could not refresh for ${context.companyName}`,
        error
      );
    }
  }
  if (status === "completed" && totals.checks > 0) {
    try {
      await syncGeoShelfCitationsStep(scope);
    } catch (error) {
      await logFollowUpFailure(
        `GEO shelf space could not refresh for ${context.companyName}`,
        error,
        { scanId: context.scanId }
      );
    }
    try {
      await startGeoSentimentStep(scope);
    } catch (error) {
      await logFollowUpFailure(
        `GEO sentiment analysis could not start for ${context.companyName}`,
        error,
        { scanId: context.scanId }
      );
    }
  }
  try {
    if (!options.willRetry) {
      await evaluateGeoAlertsStep({
        organizationId: context.organizationId,
        projectId: context.projectId,
        scanId: context.scanId,
        companyName: context.companyName,
        status,
        ...(options.failureReason
          ? { failureReason: options.failureReason }
          : {}),
      });
    }
  } catch (error) {
    await logFollowUpFailure(
      `GEO alerts could not run for ${context.companyName}`,
      error,
      { scanId: context.scanId }
    );
  }
  const errorMessage =
    status === "failed"
      ? (options.failureReason ?? "No successful checks")
      : undefined;
  await appendAutomationLogBestEffort({
    organizationId: context.organizationId,
    integrationId: context.projectId,
    integrationType: "geo",
    title:
      status === "completed"
        ? `GEO scan completed for ${context.companyName}`
        : `GEO scan failed for ${context.companyName}`,
    status: status === "completed" ? "success" : "failed",
    referenceId: context.runId,
    payload: {
      companyName: context.companyName,
      scanId: context.scanId,
      runId: context.runId,
      checks: totals.checks,
      mentions: totals.mentions,
      dropped: totals.dropped,
      prompts: plan.promptCount,
      engines: plan.engines.join(", "),
      retried: options.retried,
    },
    ...(errorMessage ? { errorMessage } : {}),
    ...(options.retentionDays ? { retentionDays: options.retentionDays } : {}),
  });
}

async function runGeoScanProjectRun(
  organizationId: string,
  projectId: string,
  options: {
    claimedAt?: string;
    scanId?: string;
    retried: boolean;
    promptIds?: string[];
    engines?: string[];
    manual?: boolean;
    retentionDays?: LogRetentionDays;
  }
): Promise<GeoScanProjectOutcome | null> {
  const { retentionDays, ...prepareOptions } = options;
  const planResult = await prepareGeoScanProjectStep(
    organizationId,
    projectId,
    prepareOptions
  );
  if (planResult.status === "skipped") {
    return null;
  }

  const { plan } = planResult;
  const state = {
    claimedAt: plan.claimedAt,
    totals: {
      checks: 0,
      mentions: 0,
      dropped: 0,
      usage: plan.usage ?? EMPTY_AGENT_TOKEN_USAGE,
      engineUsage: EMPTY_AGENT_TOKEN_USAGE,
      judgeUsage: plan.usage ?? EMPTY_AGENT_TOKEN_USAGE,
      billedChecks: 0,
      billedUsage: plan.usage ?? EMPTY_AGENT_TOKEN_USAGE,
    } satisfies GeoScanProjectTotals,
  };
  const totals: GeoScanProjectTotals = state.totals;
  const planned =
    plan.tasks.length + plan.sequences.length + plan.personas.length;

  const olostepQueries = buildGeoOlostepQueries(plan);

  try {
    // Submitted first so Olostep works through its batches while the API
    // engines run; the wait comes after so only one loop renews the claim.
    const olostepBatchIds = await submitGeoOlostepRound(
      olostepQueries,
      olostepQueries.map((_, index) => index)
    );
    const apiFailure = await runGeoScanBatchWindow(
      plan.context,
      plan.tasks.filter((task) => !isGeoOlostepEngine(task.engine)),
      GEO_SCAN_TASK_BATCH_SIZE,
      runGeoScanTaskBatchStep,
      state
    ).then(
      () => null,
      (error: unknown) => ({ error })
    );
    const resolved =
      olostepQueries.length > 0
        ? applyGeoOlostepResults(
            plan,
            await resolveGeoOlostepResults(
              plan.context,
              olostepQueries,
              olostepBatchIds,
              state
            )
          )
        : plan;
    const runs = (engine: string) => !apiFailure || isGeoOlostepEngine(engine);
    await runGeoScanBatchWindow(
      plan.context,
      resolved.tasks.filter((task) => isGeoOlostepEngine(task.engine)),
      GEO_SCAN_TASK_BATCH_SIZE,
      runGeoScanTaskBatchStep,
      state
    );
    await runGeoScanBatchWindow(
      plan.context,
      resolved.sequences.filter((sequence) => runs(sequence.engine)),
      GEO_SCAN_SEQUENCE_BATCH_SIZE,
      runGeoScanSequenceBatchStep,
      state
    );
    await runGeoScanBatchWindow(
      plan.context,
      resolved.personas.filter((persona) => runs(persona.engine)),
      GEO_SCAN_PERSONA_BATCH_SIZE,
      runGeoScanPersonaBatchStep,
      state
    );
    if (apiFailure) {
      throw apiFailure.error;
    }
  } catch (error) {
    await finalizeProjectRun(plan, totals, "failed", state.claimedAt, {
      retried: options.retried,
      willRetry: !options.retried && totals.checks === 0 && planned > 0,
      failureReason: describeGeoScanFailure(error),
      failure: classifyGeoScanExecutionFailure(error),
      ...(retentionDays ? { retentionDays } : {}),
    });
    return {
      totals,
      attempted: planned,
      noSuccessfulChecks: totals.checks === 0,
    };
  }

  // Items omitted mid-scan (paused/archived personas) were never attempted,
  // so a scan made only of them must not fail and schedule a retry.
  const attempted = planned - (totals.omitted ?? 0);
  if (totals.checks === 0 && attempted > 0) {
    await finalizeProjectRun(plan, totals, "failed", state.claimedAt, {
      retried: options.retried,
      willRetry: !options.retried,
      ...(retentionDays ? { retentionDays } : {}),
    });
    return { totals, attempted, noSuccessfulChecks: true };
  }

  await finalizeProjectRun(plan, totals, "completed", state.claimedAt, {
    retried: options.retried,
    ...(retentionDays ? { retentionDays } : {}),
  });
  return { totals, attempted, noSuccessfulChecks: false };
}

export async function geoScanWorkflow(
  payload: GeoScanPayload
): Promise<GeoScanResult> {
  "use workflow";

  try {
    return await runGeoScanWorkflow(payload);
  } finally {
    if (payload.freeScan) {
      await revokeFreeScanBalanceStep(payload.organizationId);
    }
  }
}

async function runGeoScanWorkflow(
  payload: GeoScanPayload
): Promise<GeoScanResult> {
  const startedAt = Date.now();
  const parseResult = geoScanWorkflowPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    console.error("[GEO] Invalid payload:", flattenError(parseResult.error));
    return { status: "invalid_payload" };
  }
  const {
    organizationId,
    projectId,
    claimedAt,
    scanId,
    promptIds,
    engines,
    manual,
  } = parseResult.data;

  const projectIds = await listGeoScanProjectsStep(organizationId, {
    projectId,
    claimedAt,
    manual,
  });
  if (projectIds.length === 0) {
    return { status: "skipped" };
  }
  const retentionDays = await fetchLogRetention(organizationId);
  const orderedProjectIds =
    projectId && projectIds.includes(projectId)
      ? [projectId, ...projectIds.filter((id) => id !== projectId)]
      : projectIds;

  let checks = 0;
  let mentions = 0;
  const retryProjectIds: string[] = [];
  let ranProject = false;
  for (const scanProjectId of orderedProjectIds) {
    const claimed = scanProjectId === projectId;
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- sequential projects enforce the workflow's provider concurrency budget
    const outcome = await runGeoScanProjectRun(organizationId, scanProjectId, {
      claimedAt: claimed ? claimedAt : undefined,
      scanId: claimed ? scanId : undefined,
      retried: false,
      promptIds,
      engines,
      manual,
      retentionDays,
    });
    if (!outcome) {
      continue;
    }
    ranProject = true;
    checks += outcome.totals.checks;
    mentions += outcome.totals.mentions;
    if (outcome.noSuccessfulChecks && outcome.attempted > 0) {
      retryProjectIds.push(scanProjectId);
    }
  }
  if (!ranProject) {
    return { status: "skipped" };
  }

  if (retryProjectIds.length === 0) {
    return { status: "completed", checks, mentions };
  }

  await trackGeoScanRetryScheduledStep(
    organizationId,
    retryProjectIds,
    checks,
    Date.now() - startedAt
  );
  await sleep(GEO_SCAN_NO_RESULTS_RETRY_DELAY);

  for (const retryProjectId of retryProjectIds) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- retries share the same provider concurrency budget
    const outcome = await runGeoScanProjectRun(organizationId, retryProjectId, {
      retried: true,
      promptIds,
      engines,
      manual,
      retentionDays,
    });
    if (!outcome) {
      continue;
    }
    checks += outcome.totals.checks;
    mentions += outcome.totals.mentions;
  }

  if (checks === 0) {
    const message = `GEO scan retry produced no successful checks for ${retryProjectIds.length} projects`;
    console.error(`[GEO] ${message}`);
    throw new FatalError(message);
  }
  return { status: "completed", checks, mentions };
}
