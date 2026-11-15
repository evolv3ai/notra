export const CONTENT_GENERATION_ERROR_CODES = {
  NO_ACTIVITY_TYPES_SELECTED: "NO_ACTIVITY_TYPES_SELECTED",
  NO_AVAILABLE_SOURCES: "NO_AVAILABLE_SOURCES",
} as const;

export const NO_ACTIVITY_TYPES_MESSAGE =
  "Enable at least one of includePullRequests, includeCommits, includeReleases, or includeLinearData.";

export const NO_VALID_DATA_SOURCES_MESSAGE = "No valid data sources found";
