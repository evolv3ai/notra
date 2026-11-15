import type {
  autopilotAdminRequestSchema,
  autopilotAdminRunSchema,
  autopilotAdminTraceResponseSchema,
} from "@notra/schemas/api/autopilot-admin";
import type * as z from "zod";

export type AutopilotAdminRequest = z.infer<typeof autopilotAdminRequestSchema>;
export type AutopilotAdminRun = z.infer<typeof autopilotAdminRunSchema>;
export type AutopilotAdminTrace = z.infer<
  typeof autopilotAdminTraceResponseSchema
>;
export interface AutopilotPageProps {
  slug: string;
}
export interface AutopilotTracePageProps extends AutopilotPageProps {
  runId: string;
}
export interface AutopilotRouteProps {
  params: Promise<{ slug: string }>;
}
export interface AutopilotTraceRouteProps {
  params: Promise<{ slug: string; runId: string }>;
}
export interface AutopilotPageCursor {
  before: string;
  beforeId: string;
}
export type AutopilotStatusFilter = AutopilotAdminRun["status"] | "all";

export interface AutopilotTraceEventsProps {
  events: AutopilotAdminTrace["events"];
  includeDetail: boolean;
}

export interface AutopilotTraceFindingsProps {
  findings: AutopilotAdminTrace["findings"];
}

export interface AutopilotTraceSummaryProps {
  trace: AutopilotAdminTrace;
}
