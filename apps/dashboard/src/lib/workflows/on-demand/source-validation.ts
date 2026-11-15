import { NO_VALID_DATA_SOURCES_MESSAGE } from "@notra/content-generation/constants/errors";
import type { ContentGenerationWorkflowPayload } from "@notra/content-generation/schemas";
import { findContentSourceIssue } from "@notra/content-generation/utils/sources";

import {
  WORKFLOW_FAILURE_CLASSIFICATIONS,
  WORKFLOW_ON_DEMAND_PHASES,
} from "@/constants/workflow-analytics";
import type { OnDemandSourceFailure } from "@/types/workflows/on-demand-generation";

type SourcePayload = Pick<
  ContentGenerationWorkflowPayload,
  "dataPoints" | "repositoryIds" | "linearIntegrationIds"
>;

/**
 * Explains why a queued job has nothing to read. Jobs can arrive here after
 * the request was validated, so this stays a defensive check. Callers pass a
 * payload whose Linear ids were already revalidated against the organization,
 * plus the resolved repository count.
 */
export function describeOnDemandSourceFailure(
  payload: SourcePayload,
  resolvedRepositoryCount: number
): OnDemandSourceFailure | null {
  const linearIntegrationCount = payload.linearIntegrationIds?.length ?? 0;
  const issue = findContentSourceIssue({
    dataPoints: payload.dataPoints,
    gitHubSourceCount: resolvedRepositoryCount,
    hasLinearSelection: linearIntegrationCount > 0,
  });

  if (!issue) {
    return null;
  }

  return {
    reason: `${NO_VALID_DATA_SOURCES_MESSAGE}: ${issue.message}`,
    errorCode: issue.code,
    phase: WORKFLOW_ON_DEMAND_PHASES.SOURCE_VALIDATION,
    classification: WORKFLOW_FAILURE_CLASSIFICATIONS.CONFIGURATION,
    diagnostics: {
      includePullRequests: payload.dataPoints.includePullRequests,
      includeCommits: payload.dataPoints.includeCommits,
      includeReleases: payload.dataPoints.includeReleases,
      includeLinearData: payload.dataPoints.includeLinearData,
      hasGitHubSelection: payload.repositoryIds !== undefined,
      selectedRepositoryCount: payload.repositoryIds?.length ?? 0,
      resolvedRepositoryCount,
      linearIntegrationCount,
    },
  };
}
