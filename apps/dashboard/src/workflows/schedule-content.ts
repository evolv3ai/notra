import { CONTENT_AGENT_MODEL } from "@notra/ai/constants/models";
import {
  describeContentBillingDenial,
  getContentBillingLimitLabel,
} from "@notra/ai/utils/content-billing-messages";
import { isCustomIntervalDue } from "@notra/ai/utils/schedule-interval";
import { scheduleWorkflowPayloadSchema } from "@notra/schemas/dashboard/workflows";
import { sleep } from "workflow";
import { flattenError } from "zod";

import { WORKFLOW_ANALYTICS_NAMES } from "@/constants/workflow-analytics";
import {
  GITHUB_RATE_LIMIT_RETRY_DELAY,
  SCHEDULE_AI_CREDIT_LOCK_TTL_MS,
  SCHEDULE_RATE_LIMIT_MAX_ATTEMPTS,
} from "@/constants/workflows";
import type { ContentGenerationResult } from "@/lib/workflows/schedule/types";
import { parseTriggerOutputConfig } from "@/lib/workflows/shared/parsing";
import type { ScheduleContentWorkflowResult } from "@/types/workflows/schedule-generation";
import { resolveContentLimitPauseReason } from "@/utils/content-billing";
import { parseCustomIntervalCron } from "@/utils/schedule-interval";

import {
  recordAutomationRunFinish,
  recordAutomationRunStart,
} from "./steps/automation-run-history";
import {
  appendAutomationLog,
  claimWorkflowExecution,
  cleanupEmptyCollection,
  clearWorkflowPause,
  createGenerationCollection,
  enqueueDigest,
  fetchBrandSettingsData,
  fetchGenerationUserId,
  fetchNotificationData,
  fetchScheduleSources,
  fetchScheduleTriggerContext,
  finalizeContentBilling,
  finishGeneration,
  gateContentBilling,
  notifyContentCreatedInSlack,
  notifyContentLimitReached,
  recordWorkflowPause,
  startGenerationTracking,
  trackContentOutcome,
} from "./steps/content-generation-steps";
import { runScheduledGeneration } from "./steps/schedule-generation-step";

const LOG_PREFIX = "Schedule";

export async function scheduleContentWorkflow(payload: {
  triggerId: string;
  manual?: boolean;
  executionId?: string;
  delaySeconds?: number;
}): Promise<ScheduleContentWorkflowResult> {
  "use workflow";

  const parseResult = scheduleWorkflowPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    console.error(
      "[Schedule] Invalid payload:",
      flattenError(parseResult.error)
    );
    return { status: "invalid_payload" };
  }
  const { triggerId, manual, executionId, delaySeconds } = parseResult.data;
  const creationMode = manual ? "manual" : "automatic";
  const workflowStartedAt = Date.now();
  const resolvedExecutionId = executionId ?? crypto.randomUUID();
  const claimToken = crypto.randomUUID();

  if (delaySeconds && delaySeconds > 0) {
    await sleep(delaySeconds * 1000);
  }

  const claim = await claimWorkflowExecution({
    executionId: resolvedExecutionId,
    claimToken,
    workflow: WORKFLOW_ANALYTICS_NAMES.SCHEDULE_CONTENT,
  });
  if (!claim.claimed) {
    console.warn(
      `[Schedule] Duplicate execution ${resolvedExecutionId} for trigger ${triggerId}, skipping`
    );
    return { status: "duplicate_execution" };
  }

  const { trigger, lookbackWindow } =
    await fetchScheduleTriggerContext(triggerId);
  if (!trigger) {
    console.log(`[Schedule] Trigger ${triggerId} not found, canceling`);
    if (manual) {
      await recordAutomationRunFinish({
        id: resolvedExecutionId,
        status: "failed",
        errorMessage: "The automation could not be loaded",
      });
    }
    return { status: "trigger_not_found" };
  }
  if (!trigger.enabled) {
    console.log(`[Schedule] Trigger ${triggerId} is disabled, canceling`);
    if (manual) {
      await recordAutomationRunFinish({
        id: resolvedExecutionId,
        status: "skipped",
        errorMessage: "The automation is turned off",
      });
    }
    return { status: "trigger_disabled" };
  }
  const customInterval = parseCustomIntervalCron(trigger.sourceConfig);
  if (!manual && customInterval && !isCustomIntervalDue(customInterval)) {
    console.log(
      `[Schedule] Trigger ${triggerId} is not due today (every ${customInterval.intervalDays} days), skipping`
    );
    return { status: "not_due" };
  }
  const automationName = trigger.name.trim() || trigger.outputType;
  await recordAutomationRunStart({
    id: resolvedExecutionId,
    organizationId: trigger.organizationId,
    automationId: triggerId,
    manual,
  });

  const gate = await gateContentBilling({
    organizationId: trigger.organizationId,
    executionId: resolvedExecutionId,
    outputType: trigger.outputType,
    lockTtlMs: SCHEDULE_AI_CREDIT_LOCK_TTL_MS,
  });
  if (!gate.allowed) {
    if (gate.shouldNotify) {
      await notifyContentLimitReached({
        organizationId: trigger.organizationId,
        automationName,
        logPrefix: LOG_PREFIX,
        limitLabel: getContentBillingLimitLabel(gate),
      });
      if (!manual) {
        await recordWorkflowPause({
          triggerId,
          organizationId: trigger.organizationId,
          automationName,
          reason: resolveContentLimitPauseReason(gate),
          logPrefix: LOG_PREFIX,
        });
      }
    }
    await recordAutomationRunFinish({
      id: resolvedExecutionId,
      status: "skipped",
      errorMessage: describeContentBillingDenial(gate),
    });
    return { status: "credits_exhausted" };
  }
  const releaseBilling = () =>
    finalizeContentBilling({
      reservation: gate,
      action: "release",
      logPrefix: LOG_PREFIX,
    });

  let sources: Awaited<ReturnType<typeof fetchScheduleSources>>;
  let brand: Awaited<ReturnType<typeof fetchBrandSettingsData>>;
  let generationUserId: Awaited<ReturnType<typeof fetchGenerationUserId>>;
  try {
    [sources, brand, generationUserId] = await Promise.all([
      fetchScheduleSources({
        organizationId: trigger.organizationId,
        repositoryIds: trigger.targets.repositoryIds,
        linearIntegrationIds: trigger.targets.linearIntegrationIds,
      }),
      fetchBrandSettingsData({
        organizationId: trigger.organizationId,
        outputConfig: trigger.outputConfig,
      }),
      fetchGenerationUserId(trigger.organizationId),
    ]);
  } catch (error) {
    await releaseBilling();
    await recordAutomationRunFinish({
      id: resolvedExecutionId,
      status: "failed",
      errorMessage: "Unexpected workflow error",
    });
    throw error;
  }
  const { repositories, linearIntegrationRefs } = sources;

  if (repositories.length === 0 && linearIntegrationRefs.length === 0) {
    console.log(
      `[Schedule] No valid data sources for trigger ${triggerId}, canceling`
    );
    await releaseBilling();
    await recordAutomationRunFinish({
      id: resolvedExecutionId,
      status: "skipped",
      errorMessage: "No connected data sources",
    });
    return { status: "no_sources" };
  }

  const runId = `${triggerId}-${Date.now()}`;
  const collectionId = `group_${runId}`;
  const integrationType = manual ? "manual" : "schedule";
  const logPayload = {
    runId,
    triggerName: automationName,
    outputType: trigger.outputType,
    lookbackWindow,
    repositoryCount: repositories.length,
  };

  const finish = async (
    status: "success" | "failed" | "skipped",
    { postId, ...detail }: { reason?: string; title?: string; postId?: string }
  ) => {
    await recordAutomationRunFinish({
      id: resolvedExecutionId,
      status,
      title: detail.title,
      errorMessage: detail.reason,
      postId,
    });
    await finishGeneration({
      organizationId: trigger.organizationId,
      runId,
      workflow: WORKFLOW_ANALYTICS_NAMES.SCHEDULE_CONTENT,
      startedAt: workflowStartedAt,
      triggerId,
      outputType: trigger.outputType,
      triggerName: automationName,
      status,
      ...detail,
    });
  };
  const cleanupCollection = () =>
    cleanupEmptyCollection({
      collectionId,
      organizationId: trigger.organizationId,
    });
  const pauseAutomaticRun = async () => {
    if (!manual) {
      await recordWorkflowPause({
        triggerId,
        organizationId: trigger.organizationId,
        automationName,
        reason: "workflow_errors",
        logPrefix: LOG_PREFIX,
      });
    }
  };
  const reportUnsuccessfulRun = async (
    kind: "failed" | "skipped",
    reason: string
  ) => {
    await appendAutomationLog({
      organizationId: trigger.organizationId,
      integrationId: triggerId,
      integrationType,
      title:
        kind === "failed"
          ? `Schedule "${automationName}" failed to generate content`
          : `Schedule "${automationName}" skipped content generation`,
      payload: logPayload,
      status: kind,
      errorMessage: reason,
    });
    await trackContentOutcome({
      kind,
      triggerId: trigger.id,
      organizationId: trigger.organizationId,
      outputType: trigger.outputType,
      creationMode,
      reason,
      lookbackWindow,
      repositoryCount: repositories.length,
      source: "schedule",
      logPrefix: LOG_PREFIX,
    });
    const notificationData = await fetchNotificationData({
      organizationId: trigger.organizationId,
      setting:
        kind === "failed"
          ? "scheduledContentFailed"
          : "scheduledContentSkipped",
    });
    if (notificationData.enabled && notificationData.ownerEmails.length > 0) {
      await enqueueDigest({
        organizationId: trigger.organizationId,
        recipientEmails: notificationData.ownerEmails,
        kind:
          kind === "failed"
            ? "scheduled_content_failed"
            : "scheduled_content_skipped",
        event: {
          organizationName: notificationData.organizationName,
          organizationSlug: notificationData.organizationSlug,
          scheduleName: automationName,
          reason,
        },
        logPrefix: LOG_PREFIX,
      });
    }
  };

  try {
    await startGenerationTracking({
      organizationId: trigger.organizationId,
      runId,
      triggerId: trigger.id,
      outputType: trigger.outputType,
      triggerName: automationName,
    });
    await createGenerationCollection({
      collectionId,
      organizationId: trigger.organizationId,
      source: trigger.sourceType === "cron" ? "schedule" : "automation",
      sourceId: runId,
      outputType: trigger.outputType,
      sourceMetadata: {
        triggerId: trigger.id,
        triggerName: trigger.name,
        triggerSourceType: trigger.sourceType,
        manualRun: manual,
      },
    });

    let contentResult: ContentGenerationResult | null = null;
    for (
      let attempt = 1;
      attempt <= SCHEDULE_RATE_LIMIT_MAX_ATTEMPTS;
      attempt++
    ) {
      contentResult = await runScheduledGeneration({
        trigger,
        lookbackWindow,
        repositories,
        linearIntegrationRefs,
        brand,
        collectionId,
        generationUserId,
        manual,
        chargeAiCredits: gate.mode === "ai_credits",
      });
      if (contentResult.status !== "rate_limited") {
        break;
      }
      if (attempt < SCHEDULE_RATE_LIMIT_MAX_ATTEMPTS) {
        console.warn(
          `[Schedule] GitHub API rate limit hit for trigger ${triggerId}. Retrying after ${GITHUB_RATE_LIMIT_RETRY_DELAY} (attempt ${attempt}).`
        );
        await sleep(GITHUB_RATE_LIMIT_RETRY_DELAY);
      }
    }
    if (!contentResult) {
      throw new Error("Content generation produced no result");
    }

    if (contentResult.status === "rate_limited") {
      await finish("failed", {
        reason: "GitHub API rate limit hit repeatedly",
      });
      await releaseBilling();
      await cleanupCollection();
      return { status: "rate_limited_exhausted" };
    }

    if (contentResult.status === "unsupported_output_type") {
      await finish("failed", { reason: "Unsupported output type" });
      await releaseBilling();
      await pauseAutomaticRun();
      await cleanupCollection();
      return { status: "unsupported_output_type" };
    }

    if (contentResult.status === "generation_failed") {
      await releaseBilling();
      await finish("failed", { reason: contentResult.reason });
      await reportUnsuccessfulRun("failed", contentResult.reason);
      await pauseAutomaticRun();
      await cleanupCollection();
      return { status: "generation_failed", reason: contentResult.reason };
    }

    if (contentResult.status === "skipped") {
      await releaseBilling();
      await finish("skipped", { reason: contentResult.reason });
      await reportUnsuccessfulRun("skipped", contentResult.reason);
      await cleanupCollection();
      if (!manual) {
        await clearWorkflowPause({ triggerId, logPrefix: LOG_PREFIX });
      }
      return { status: "skipped", reason: contentResult.reason };
    }

    const createdPosts = contentResult.posts;
    const [primaryPost] = createdPosts;

    if (!primaryPost) {
      console.warn("[Schedule] Content generation returned no posts", {
        triggerId,
      });
      await finish("failed", {
        reason: "Content generation returned no posts",
      });
      await releaseBilling();
      await pauseAutomaticRun();
      await cleanupCollection();
      return { status: "empty_result" };
    }

    const postId = primaryPost.postId;
    const contentTitle =
      createdPosts.length === 1
        ? primaryPost.title
        : `${createdPosts.length} ${trigger.outputType.replaceAll("_", " ")} drafts`;

    await finish("success", { title: contentTitle, postId });

    await finalizeContentBilling({
      reservation: gate,
      action: "confirm",
      units: createdPosts.length,
      usage: contentResult.usage,
      fallbackModelId: CONTENT_AGENT_MODEL,
      properties: {
        source: "workflow_schedule",
        output_type: trigger.outputType,
        trigger_name: automationName,
        trigger_id: triggerId,
        run_id: runId,
        markup_applied: gate.useMarkup,
      },
      logPrefix: LOG_PREFIX,
    }).catch((billingError) => {
      console.error(
        `[${LOG_PREFIX}] Billing confirmation failed for run ${runId}; content remains created`,
        billingError
      );
    });

    try {
      const notify = parseTriggerOutputConfig(trigger.outputConfig)?.notify;
      if (notify?.slack) {
        await notifyContentCreatedInSlack({
          organizationId: trigger.organizationId,
          automationName,
          posts: createdPosts.map(({ postId, title }) => ({ postId, title })),
        });
      }
      await appendAutomationLog({
        organizationId: trigger.organizationId,
        integrationId: triggerId,
        integrationType,
        title:
          createdPosts.length === 1
            ? `Schedule "${automationName}" created "${contentTitle}"`
            : `Schedule "${automationName}" created ${createdPosts.length} drafts`,
        status: "success",
        referenceId: postId,
        payload: logPayload,
      });
      await trackContentOutcome({
        kind: "created",
        triggerId: trigger.id,
        organizationId: trigger.organizationId,
        outputType: trigger.outputType,
        creationMode,
        lookbackWindow,
        repositoryCount: repositories.length,
        source: "schedule",
        postIds: createdPosts.map((createdPost) => createdPost.postId),
        logPrefix: LOG_PREFIX,
      });
      const notificationData = await fetchNotificationData({
        organizationId: trigger.organizationId,
        setting: "scheduledContentCreation",
        force: notify?.email,
      });
      if (notificationData.enabled && notificationData.ownerEmails.length > 0) {
        const baseUrl = process.env.APP_URL ?? "https://app.usenotra.com";
        const contentOverviewLink = `${baseUrl}/${notificationData.organizationSlug}/content`;
        await enqueueDigest({
          organizationId: trigger.organizationId,
          recipientEmails: notificationData.ownerEmails,
          kind: "scheduled_content_created",
          event: {
            organizationName: notificationData.organizationName,
            organizationSlug: notificationData.organizationSlug,
            scheduleName: automationName,
            createdContent: createdPosts.map((createdPost) => ({
              title: createdPost.title,
              contentLink: `${contentOverviewLink}/${createdPost.postId}`,
            })),
            contentType: trigger.outputType,
            contentOverviewLink,
            automationEmail: notify?.email === true,
            subject: manual
              ? `New content created from ${automationName}`
              : `Your ${automationName} schedule created new content`,
          },
          logPrefix: LOG_PREFIX,
        });
      }
      if (!manual) {
        await clearWorkflowPause({ triggerId, logPrefix: LOG_PREFIX });
      }
    } catch (postSuccessError) {
      console.error(
        `[Schedule] Post-success effects failed for trigger ${triggerId}; content remains created`,
        postSuccessError
      );
    }

    return { status: "success", triggerId, postId };
  } catch (error) {
    await finish("failed", { reason: "Unexpected workflow error" });
    await releaseBilling();
    await cleanupCollection();
    await pauseAutomaticRun();
    throw error;
  }
}
