import type { CONTENT_GENERATION_ERROR_CODES } from "../constants/errors";

export type ContentGenerationErrorCode =
  (typeof CONTENT_GENERATION_ERROR_CODES)[keyof typeof CONTENT_GENERATION_ERROR_CODES];

export interface ContentSourceAvailabilityInput {
  dataPoints: {
    includePullRequests: boolean;
    includeCommits: boolean;
    includeReleases: boolean;
    includeLinearData: boolean;
  };
  /** GitHub repositories that will actually be read for this run. */
  gitHubSourceCount: number;
  /** Whether the request selected Linear integrations. */
  hasLinearSelection: boolean;
}

export interface ContentSourceIssue {
  code: ContentGenerationErrorCode;
  message: string;
}
