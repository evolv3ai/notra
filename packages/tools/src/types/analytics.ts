export interface AnalyticsRangeInput {
  days: number;
  from?: string;
  to?: string;
}

export interface AnalyticsRange {
  from: string;
  to: string;
  days: number;
  timezone: "UTC";
}

export interface AnalyticsProject {
  id: string;
  name: string;
  isDefault: boolean;
  /** Other projects in the organization this result does not cover. */
  otherProjects: number;
}
