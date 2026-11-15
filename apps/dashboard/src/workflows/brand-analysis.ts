import { publicWebsiteUrlSchema } from "@notra/geo-core/schemas/url";
import { flattenError, object, string } from "zod";

import type { BrandAnalysisPayload } from "@/types/brand-analysis";
import type { LogRetentionDays } from "@/types/webhooks/webhooks";
import type { BrandAnalysisWorkflowResult } from "@/types/workflows/brand-analysis";

import {
  extractBrandInfo,
  saveBrandSettingsFromAnalysis,
  scrapeBrandWebsite,
  setBrandAnalysisProgress,
} from "./steps/brand-analysis-steps";
import {
  appendAutomationLogBestEffort,
  fetchLogRetention,
} from "./steps/content-generation-steps";

const STEP_COUNT = 3;

export const brandAnalysisPayloadSchema = object({
  organizationId: string().min(1),
  url: publicWebsiteUrlSchema,
  voiceId: string().optional(),
  jobId: string().optional(),
});

interface BrandAnalysisLogContext {
  organizationId: string;
  url: string;
  voiceId?: string;
  jobId?: string;
  retentionDays: LogRetentionDays;
}

async function logBrandAnalysisRun(
  context: BrandAnalysisLogContext,
  outcome:
    | { status: "success"; companyName?: string }
    | { status: "failed"; stage: string; errorMessage: string }
): Promise<void> {
  await appendAutomationLogBestEffort({
    organizationId: context.organizationId,
    integrationId: context.voiceId ?? context.organizationId,
    integrationType: "brand",
    title:
      outcome.status === "success"
        ? `Brand analysis completed${outcome.companyName ? ` for ${outcome.companyName}` : ""}`
        : "Brand analysis failed",
    status: outcome.status,
    payload: {
      url: context.url,
      ...(outcome.status === "failed" ? { stage: outcome.stage } : {}),
    },
    ...(outcome.status === "failed"
      ? { errorMessage: outcome.errorMessage }
      : {}),
    ...(context.jobId ? { referenceId: context.jobId } : {}),
    retentionDays: context.retentionDays,
  });
}

export async function brandAnalysisWorkflow(
  payload: BrandAnalysisPayload
): Promise<BrandAnalysisWorkflowResult> {
  "use workflow";

  const parseResult = brandAnalysisPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    console.error(
      "[Brand Analysis] Invalid payload:",
      flattenError(parseResult.error)
    );
    return { status: "invalid_payload" };
  }
  const { organizationId, url, voiceId, jobId } = parseResult.data;
  const workflowStartedAt = Date.now();
  const retentionDays = await fetchLogRetention(organizationId);
  const logContext: BrandAnalysisLogContext = {
    organizationId,
    url,
    retentionDays,
    ...(voiceId ? { voiceId } : {}),
    ...(jobId ? { jobId } : {}),
  };

  const setStage = (
    status: "scraping" | "extracting" | "saving" | "completed",
    currentStep: number
  ) =>
    setBrandAnalysisProgress({
      organizationId,
      jobId,
      startedAt: workflowStartedAt,
      progress: { status, currentStep, totalSteps: STEP_COUNT },
    });
  const reportFailure = async (
    currentStep: number,
    stage: string,
    error: string
  ) => {
    await setBrandAnalysisProgress({
      organizationId,
      websiteUrl: url,
      jobId,
      startedAt: workflowStartedAt,
      progress: {
        status: "failed",
        currentStep,
        totalSteps: STEP_COUNT,
        error,
      },
    });
    await logBrandAnalysisRun(logContext, {
      status: "failed",
      stage,
      errorMessage: error,
    });
  };

  try {
    await setStage("scraping", 1);

    const scrapingResult = await scrapeBrandWebsite(url);
    if (!scrapingResult.success) {
      await reportFailure(1, "scraping", scrapingResult.error);
      return { status: "scraping_failed" };
    }

    await setStage("extracting", 2);

    const extractionResult = await extractBrandInfo({
      content: scrapingResult.content,
      organizationId,
      jobId,
      voiceId,
    });
    if (!extractionResult.success) {
      await reportFailure(2, "extraction", extractionResult.error);
      return { status: "extraction_failed" };
    }

    await setStage("saving", 3);

    await saveBrandSettingsFromAnalysis({
      organizationId,
      voiceId,
      url,
      brandInfo: extractionResult.brandInfo,
    });

    await setStage("completed", 3);

    await logBrandAnalysisRun(logContext, {
      status: "success",
      ...(extractionResult.brandInfo.companyName
        ? { companyName: extractionResult.brandInfo.companyName }
        : {}),
    });

    return { status: "completed", brandInfo: extractionResult.brandInfo };
  } catch (error) {
    await reportFailure(0, "unexpected", "Workflow failed unexpectedly");
    console.error(
      `[Brand Analysis] Workflow failed for organization ${organizationId}`
    );
    throw error;
  }
}
