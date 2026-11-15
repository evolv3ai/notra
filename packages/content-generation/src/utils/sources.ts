import {
  CONTENT_GENERATION_ERROR_CODES,
  NO_ACTIVITY_TYPES_MESSAGE,
} from "../constants/errors";
import type {
  ContentSourceAvailabilityInput,
  ContentSourceIssue,
} from "../types/sources";

export function hasEnabledActivityType(
  dataPoints: ContentSourceAvailabilityInput["dataPoints"]
) {
  return (
    dataPoints.includePullRequests ||
    dataPoints.includeCommits ||
    dataPoints.includeReleases ||
    dataPoints.includeLinearData
  );
}

/**
 * Returns why a generation request has nothing to read, or null when at least
 * one enabled activity type has a source behind it. Add new source kinds here
 * so the public API and the workflow keep rejecting the same requests.
 */
export function findContentSourceIssue(
  input: ContentSourceAvailabilityInput
): ContentSourceIssue | null {
  const { dataPoints, gitHubSourceCount, hasLinearSelection } = input;

  if (!hasEnabledActivityType(dataPoints)) {
    return {
      code: CONTENT_GENERATION_ERROR_CODES.NO_ACTIVITY_TYPES_SELECTED,
      message: NO_ACTIVITY_TYPES_MESSAGE,
    };
  }

  const gitHubActivityEnabled =
    dataPoints.includePullRequests ||
    dataPoints.includeCommits ||
    dataPoints.includeReleases;
  const hasUsableGitHub = gitHubActivityEnabled && gitHubSourceCount > 0;
  const hasUsableLinear = dataPoints.includeLinearData && hasLinearSelection;

  if (hasUsableGitHub || hasUsableLinear) {
    return null;
  }

  const code = CONTENT_GENERATION_ERROR_CODES.NO_AVAILABLE_SOURCES;

  if (dataPoints.includeLinearData && !hasLinearSelection) {
    return {
      code,
      message:
        "includeLinearData is enabled but no Linear integration was selected. Select one with integrations.linear, or enable GitHub activity and select a GitHub source.",
    };
  }

  if (hasLinearSelection && !dataPoints.includeLinearData) {
    return {
      code,
      message:
        "Linear integrations were selected but includeLinearData is false. Set includeLinearData to true or select a GitHub source.",
    };
  }

  if (!gitHubActivityEnabled) {
    return {
      code,
      message:
        "No enabled activity type has a source. Enable includePullRequests, includeCommits, or includeReleases and select a GitHub source.",
    };
  }

  return {
    code,
    message:
      "No connected GitHub repository is available for this request. Connect a repository, or select sources with integrations.github, integrations.linear, or github.repositories.",
  };
}
