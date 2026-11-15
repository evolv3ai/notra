import "@/workflows/runtime";
import { db } from "@notra/db/drizzle";
import { githubIntegrations, linearIntegrations } from "@notra/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import { WORKFLOW_OUTCOMES } from "@/constants/workflow-analytics";
import { trackWorkflowOutcomeAndFlush } from "@/lib/analytics/workflow-lifecycle";
import { completeActiveGeneration } from "@/lib/generations/tracking";
import { resolveBrandVoiceForManualGeneration } from "@/lib/workflows/on-demand/helpers";
import {
  appendTrackedJobEvent,
  setTrackedJobStatus,
} from "@/lib/workflows/on-demand/job-tracking";
import { reconcileUnsuccessfulPostCollectionAttempt } from "@/lib/workflows/on-demand/reconcile";
import type { FinishOnDemandInput } from "@/types/workflows/on-demand-generation";
import type {
  ScheduleBrandSettingsData,
  ScheduleRepositoryData,
} from "@/types/workflows/workflows";

export async function markOnDemandJobRunning(input: {
  jobId?: string;
  contentType: string;
}): Promise<void> {
  "use step";
  await setTrackedJobStatus(input.jobId, "running");
  await appendTrackedJobEvent(
    input.jobId,
    "running",
    `Started ${input.contentType.replaceAll("_", " ")} generation`
  );
  await appendTrackedJobEvent(
    input.jobId,
    "fetching_repositories",
    "Resolving repository sources"
  );
}

export async function logOnDemandGenerating(jobId?: string): Promise<void> {
  "use step";
  await appendTrackedJobEvent(
    jobId,
    "generating_content",
    "Generating content from repository activity"
  );
}

export async function fetchOnDemandRepositories(input: {
  organizationId: string;
  repositoryIds?: string[];
  linearIntegrationIds?: string[];
}): Promise<ScheduleRepositoryData[]> {
  "use step";
  const repos = await db
    .select({
      id: githubIntegrations.id,
      owner: githubIntegrations.owner,
      repo: githubIntegrations.repo,
      defaultBranch: githubIntegrations.defaultBranch,
    })
    .from(githubIntegrations)
    .where(
      and(
        eq(githubIntegrations.organizationId, input.organizationId),
        eq(githubIntegrations.enabled, true)
      )
    );

  const validRepos: ScheduleRepositoryData[] = [];
  for (const repo of repos) {
    if (repo.owner && repo.repo) {
      validRepos.push({
        id: repo.id,
        owner: repo.owner,
        repo: repo.repo,
        defaultBranch: repo.defaultBranch,
      });
    }
  }

  if (input.repositoryIds !== undefined) {
    if (input.repositoryIds.length === 0) {
      return [];
    }
    const requestedIds = new Set(input.repositoryIds);
    return validRepos.filter((repo) => requestedIds.has(repo.id));
  }

  if (input.linearIntegrationIds && input.linearIntegrationIds.length > 0) {
    return [];
  }

  return validRepos;
}

/**
 * Linear selections are made when the run is queued, so integrations can be
 * disabled or removed before it starts. Keep only the ones still enabled for
 * this organization so source checks and generation never see stale ids.
 */
export async function resolveOnDemandLinearIntegrationIds(input: {
  organizationId: string;
  linearIntegrationIds?: string[];
}): Promise<string[] | undefined> {
  "use step";
  if (input.linearIntegrationIds === undefined) {
    return undefined;
  }
  if (input.linearIntegrationIds.length === 0) {
    return [];
  }

  const enabled = await db
    .select({ id: linearIntegrations.id })
    .from(linearIntegrations)
    .where(
      and(
        eq(linearIntegrations.organizationId, input.organizationId),
        eq(linearIntegrations.enabled, true),
        inArray(linearIntegrations.id, input.linearIntegrationIds)
      )
    );
  const enabledIds = new Set(enabled.map((integration) => integration.id));

  return input.linearIntegrationIds.filter((id) => enabledIds.has(id));
}

export async function resolveManualBrandSettings(input: {
  organizationId: string;
  brandVoiceId?: string;
}): Promise<ScheduleBrandSettingsData> {
  "use step";
  const result = await resolveBrandVoiceForManualGeneration(
    input.organizationId,
    input.brandVoiceId
  );
  if (!result.brand) {
    return null;
  }
  return {
    id: result.brand.id,
    name: result.brand.name,
    toneProfile: result.brand.toneProfile,
    customTone: result.brand.customTone,
    companyName: result.brand.companyName,
    companyDescription: result.brand.companyDescription,
    audience: result.brand.audience,
    customInstructions: result.brand.customInstructions,
    language: result.brand.language,
  };
}

export async function finishOnDemand(
  input: FinishOnDemandInput
): Promise<void> {
  "use step";
  await completeActiveGeneration(input.organizationId, {
    runId: input.runId,
    triggerId: "manual_on_demand",
    outputType: input.contentType,
    triggerName: input.contentType,
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.title ? { title: input.title } : {}),
    completedAt: new Date().toISOString(),
    source: input.source,
  });
  if (input.workflow) {
    await trackWorkflowOutcomeAndFlush({
      workflow: input.workflow,
      outcome:
        input.status === "failed"
          ? WORKFLOW_OUTCOMES.FAILED
          : WORKFLOW_OUTCOMES.COMPLETED,
      organizationId: input.organizationId,
      runId: input.runId,
      startedAt: input.startedAt,
      reason: input.reason,
      errorCode: input.errorCode,
      phase: input.phase,
      classification: input.classification,
      diagnostics: input.diagnostics,
      properties: {
        status: input.status,
        output_type: input.contentType,
        trigger: input.source,
        post_count: input.postCount,
      },
    });
  }

  if (input.status === "success") {
    await setTrackedJobStatus(input.jobId, "completed", {
      postId: input.primaryPostId ?? null,
      error: null,
    });
    await appendTrackedJobEvent(
      input.jobId,
      "post_created",
      input.postCount === 1
        ? `Created post ${input.primaryPostId ?? ""}`
        : `Created ${input.postCount ?? 0} posts`,
      { postId: input.primaryPostId ?? null }
    );
    await appendTrackedJobEvent(
      input.jobId,
      "completed",
      `Completed ${input.contentType.replaceAll("_", " ")} generation`,
      { postId: input.primaryPostId ?? null }
    );
    return;
  }

  await setTrackedJobStatus(input.jobId, input.status, {
    error: input.reason ?? null,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  });
  await appendTrackedJobEvent(
    input.jobId,
    input.status,
    input.reason ?? "Generation did not complete",
    input.errorCode ? { errorCode: input.errorCode } : null
  );
}

export async function reconcileCollectionAttempt(input: {
  collectionId: string;
  organizationId: string;
  runId: string;
}): Promise<void> {
  "use step";
  await reconcileUnsuccessfulPostCollectionAttempt(input);
}
