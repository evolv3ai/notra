import { chatWorkflowPayloadSchema } from "@notra/ai/schemas/chat";
import { publicationSyncRepairSchema } from "@notra/ai/schemas/content-publication";
import type { BrandGuidelinesWorkflowPayload } from "@notra/ai/types/brand-guidelines";
import type { ChatWorkflowPayload } from "@notra/ai/types/chat";
import type { GitHubMentionContext } from "@notra/ai/types/github-mention";
import type { OnboardingAgentWorkflowPayload } from "@notra/ai/types/onboarding-agent";
import { contentGenerationWorkflowPayloadSchema } from "@notra/content-generation/schemas";
import { agentReadinessWorkflowPayloadSchema } from "@notra/geo-core/schemas/agent-readiness";
import {
  geoScanWorkflowPayloadSchema,
  geoWriterWorkflowPayloadSchema,
} from "@notra/geo-core/schemas/geo-workflows";
import { gscSyncPayloadSchema } from "@notra/geo-core/schemas/google-search-console";
import type { AgentReadinessWorkflowPayload } from "@notra/geo-core/types/agent-readiness";
import type { GeoWriterPayload } from "@notra/geo-core/types/geo";
import type { GscSyncPayload } from "@notra/geo-core/types/google-search-console";
import { socialAnalyticsSyncPayloadSchema } from "@notra/schemas/dashboard/analytics";
import { brandGuidelinesWorkflowPayloadSchema } from "@notra/schemas/dashboard/brand-guidelines";
import {
  eventWorkflowPayloadSchema,
  scheduleWorkflowPayloadSchema,
} from "@notra/schemas/dashboard/workflows";
import { onboardingAgentWorkflowPayloadSchema } from "@notra/schemas/dashboard/workflows/onboarding-agent-payload";
import { start } from "workflow/api";

import {
  WORKFLOW_ANALYTICS_NAMES,
  WORKFLOW_TRIGGERS,
} from "@/constants/workflow-analytics";
import { trackWorkflowStarted } from "@/lib/analytics/workflow-lifecycle";
import { autopilotPullRequestEventSchema } from "@/schemas/autopilot-github";
import type {
  AutopilotSuggestionWorkflowPayload,
  AutopilotPullRequestWorkflowPayload,
} from "@/types/autopilot";
import type { BrandAnalysisPayload } from "@/types/brand-analysis";
import type { ScheduledPublicationWorkflowInput } from "@/types/content/scheduled-publications";
import type { SiteJobRunHandle } from "@/types/sites-server";
import type { WorkflowGraphRunPayload } from "@/types/workflow-engine";
import { autopilotPullRequestMoment } from "@/utils/autopilot-github";
import { agentReadinessWorkflow } from "@/workflows/agent-readiness";
import { autopilotPullRequestWorkflow } from "@/workflows/autopilot-pull-request";
import { autopilotSuggestionWorkflow } from "@/workflows/autopilot-suggestion";
import {
  brandAnalysisPayloadSchema,
  brandAnalysisWorkflow,
} from "@/workflows/brand-analysis";
import { brandGuidelinesWorkflow } from "@/workflows/brand-guidelines";
import { standaloneChatWorkflow } from "@/workflows/chat";
import { contentPublicationReconciliationWorkflow } from "@/workflows/content-publication-reconciliation";
import { contentPublicationSyncRepairWorkflow } from "@/workflows/content-publication-sync-repair";
import { eventContentWorkflow } from "@/workflows/event-content";
import { geoScanWorkflow } from "@/workflows/geo-scan";
import { geoWriterWorkflow } from "@/workflows/geo-writer";
import { githubMentionWorkflow } from "@/workflows/github-mention";
import { gscSyncWorkflow } from "@/workflows/gsc-sync";
import { onDemandContentWorkflow } from "@/workflows/on-demand-content";
import { onboardingAgentWorkflow } from "@/workflows/onboarding-agent";
import { scheduleContentWorkflow } from "@/workflows/schedule-content";
import { scheduledPublicationWorkflow } from "@/workflows/scheduled-publication";
import { siteJobWorkflow } from "@/workflows/site-job";
import { socialAnalyticsSyncWorkflow } from "@/workflows/social-analytics-sync";
import { workflowGraphWorkflow } from "@/workflows/workflow-graph";

export async function startSiteJobRun(
  jobId: string
): Promise<SiteJobRunHandle> {
  const run = await start(siteJobWorkflow, [jobId]);
  return { runId: run.runId };
}

export async function startGitHubMentionRun(context: GitHubMentionContext) {
  const run = await start(githubMentionWorkflow, [context]);
  return { runId: run.runId };
}

export async function startBrandAnalysisRun(
  payload: BrandAnalysisPayload
): Promise<{ runId: string }> {
  const parsed = brandAnalysisPayloadSchema.parse(payload);
  const run = await start(brandAnalysisWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.BRAND_ANALYSIS,
    runId: run.runId,
    organizationId: parsed.organizationId,
    properties: { job_id: parsed.jobId },
  });
  return { runId: run.runId };
}

export async function startBrandGuidelinesRun(
  payload: BrandGuidelinesWorkflowPayload
): Promise<{ runId: string }> {
  const parsed = brandGuidelinesWorkflowPayloadSchema.parse(payload);
  const run = await start(brandGuidelinesWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.BRAND_GUIDELINES,
    runId: run.runId,
    organizationId: parsed.organizationId,
  });
  return { runId: run.runId };
}

export async function startStandaloneChatRun(
  payload: ChatWorkflowPayload
): Promise<{ runId: string }> {
  const parsed = chatWorkflowPayloadSchema.parse(payload);
  const run = await start(standaloneChatWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.CHAT,
    runId: run.runId,
    organizationId: parsed.organizationId,
    userId: parsed.userId,
    properties: { chat_id: parsed.chatId, request_id: parsed.requestId },
  });
  return { runId: run.runId };
}

export async function startContentPublicationReconciliation(
  publication: Parameters<typeof contentPublicationReconciliationWorkflow>[0],
  publishedAt: string
): Promise<void> {
  await start(contentPublicationReconciliationWorkflow, [
    publication,
    publishedAt,
  ]);
}

export async function startContentPublicationSyncRepair(
  repair: Parameters<typeof contentPublicationSyncRepairWorkflow>[0]
): Promise<void> {
  await start(contentPublicationSyncRepairWorkflow, [
    publicationSyncRepairSchema.parse(repair),
  ]);
}

export async function startScheduledPublicationRun(
  input: ScheduledPublicationWorkflowInput
): Promise<{ runId: string }> {
  const run = await start(scheduledPublicationWorkflow, [input]);
  return { runId: run.runId };
}

export async function startOnboardingAgentRun(
  payload: OnboardingAgentWorkflowPayload
): Promise<{ runId: string }> {
  const parsed = onboardingAgentWorkflowPayloadSchema.parse(payload);
  const run = await start(onboardingAgentWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.ONBOARDING_AGENT,
    runId: run.runId,
    organizationId: parsed.organizationId,
  });
  return { runId: run.runId };
}

export async function startScheduleRun(payload: {
  triggerId: string;
  manual?: boolean;
  executionId?: string;
  delaySeconds?: number;
}): Promise<{ runId: string }> {
  const parsed = scheduleWorkflowPayloadSchema.parse(payload);
  const run = await start(scheduleContentWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.SCHEDULE_CONTENT,
    runId: run.runId,
    trigger: parsed.manual
      ? WORKFLOW_TRIGGERS.MANUAL
      : WORKFLOW_TRIGGERS.SCHEDULE,
    properties: {
      trigger_id: parsed.triggerId,
      execution_id: parsed.executionId,
      delay_seconds: parsed.delaySeconds,
    },
  });
  return { runId: run.runId };
}

export async function startEventRun(payload: {
  triggerId: string;
  eventType: string;
  eventAction: string;
  eventData: Record<string, unknown>;
  repositoryId: string;
  deliveryId?: string;
  executionId?: string;
}): Promise<{ runId: string }> {
  const parsed = eventWorkflowPayloadSchema.parse(payload);
  const run = await start(eventContentWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.EVENT_CONTENT,
    runId: run.runId,
    trigger: WORKFLOW_TRIGGERS.EVENT,
    properties: {
      trigger_id: parsed.triggerId,
      event_type: parsed.eventType,
      event_action: parsed.eventAction,
      execution_id: parsed.executionId,
    },
  });
  return { runId: run.runId };
}

export async function startSocialAnalyticsSyncRun(payload: {
  organizationId?: string;
}): Promise<{ runId: string }> {
  const parsed = socialAnalyticsSyncPayloadSchema.parse(payload);
  const run = await start(socialAnalyticsSyncWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.SOCIAL_ANALYTICS_SYNC,
    runId: run.runId,
    organizationId: parsed.organizationId,
  });
  return { runId: run.runId };
}

export async function startGeoScanRun(payload: {
  organizationId: string;
  projectId?: string;
  claimedAt?: string;
  scanId?: string;
  promptIds?: string[];
  engines?: string[];
  manual?: boolean;
  freeScan?: boolean;
}): Promise<{ runId: string }> {
  const parsed = geoScanWorkflowPayloadSchema.parse(payload);
  const run = await start(geoScanWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.GEO_SCAN,
    runId: run.runId,
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    properties: { scan_id: parsed.scanId },
  });
  return { runId: run.runId };
}

export async function startGeoWriterRun(
  payload: GeoWriterPayload
): Promise<{ runId: string }> {
  const parsed = geoWriterWorkflowPayloadSchema.parse(payload);
  const run = await start(geoWriterWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.GEO_WRITER,
    runId: run.runId,
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    properties: { brief_id: parsed.briefId },
  });
  return { runId: run.runId };
}

export async function startAgentReadinessRun(
  payload: AgentReadinessWorkflowPayload
): Promise<{ runId: string }> {
  const parsed = agentReadinessWorkflowPayloadSchema.parse(payload);
  const run = await start(agentReadinessWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.AGENT_READINESS,
    runId: run.runId,
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    properties: { report_id: parsed.reportId },
  });
  return { runId: run.runId };
}

export async function startWorkflowGraphRun(
  payload: WorkflowGraphRunPayload,
  trigger: string
): Promise<{ runId: string }> {
  const run = await start(workflowGraphWorkflow, [payload]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.WORKFLOW_GRAPH,
    runId: run.runId,
    organizationId: payload.organizationId,
    properties: { workflow_run_id: payload.runId, trigger },
  });
  return { runId: run.runId };
}

export async function startAutopilotSuggestionWorkflowRun(
  payload: AutopilotSuggestionWorkflowPayload
): Promise<{ runId: string }> {
  const run = await start(autopilotSuggestionWorkflow, [payload]);
  return { runId: run.runId };
}

export async function startAutopilotPullRequestWorkflowRun(
  payload: AutopilotPullRequestWorkflowPayload
): Promise<{ runId: string } | null> {
  if (!payload.deliveryId) {
    throw new Error("GitHub delivery ID is required");
  }
  const parsed = autopilotPullRequestEventSchema.safeParse(
    JSON.parse(payload.rawBody)
  );
  if (!parsed.success || !autopilotPullRequestMoment(parsed.data)) {
    return null;
  }
  const run = await start(autopilotPullRequestWorkflow, [
    { deliveryId: payload.deliveryId, rawBody: JSON.stringify(parsed.data) },
  ]);
  return { runId: run.runId };
}

export async function startGscSyncRun(
  payload: GscSyncPayload
): Promise<{ runId: string }> {
  const parsed = gscSyncPayloadSchema.parse(payload);
  const run = await start(gscSyncWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.GSC_SYNC,
    runId: run.runId,
    organizationId: parsed.organizationId,
  });
  return { runId: run.runId };
}

export async function startOnDemandRun(
  payload: unknown
): Promise<{ runId: string }> {
  const parsed = contentGenerationWorkflowPayloadSchema.parse(payload);
  const run = await start(onDemandContentWorkflow, [parsed]);
  trackWorkflowStarted({
    workflow: WORKFLOW_ANALYTICS_NAMES.ON_DEMAND_CONTENT,
    runId: run.runId,
    organizationId: parsed.organizationId,
    trigger: parsed.source,
    properties: {
      execution_id: parsed.runId,
      content_type: parsed.contentType,
    },
  });
  return { runId: run.runId };
}
