import type { AgentTokenUsage } from "@notra/ai/types/agents";
import type { AutopilotPlannerState } from "@notra/ai/types/autopilot-planner";
import type { createOctokit } from "@notra/ai/utils/octokit";
import type { autopilotFindings, autopilotRuns } from "@notra/db/schema";
import type { AgentReadinessIssue } from "@notra/db/types/agent-readiness";
import type {
  AutopilotEventLevel,
  AutopilotFindingEvidence,
  AutopilotImpactTarget,
  AutopilotRunEventData,
  AutopilotTraceDetail,
  AutopilotJobKind,
} from "@notra/db/types/autopilot";
import type { AgentReadinessReportView } from "@notra/geo-core/types/agent-readiness";
import type * as z from "zod";

import type {
  blogFileSchema,
  readinessAgentOutputSchema,
} from "@/schemas/autopilot";
import type { AutopilotProposal, MergedPullRequest } from "@/types/autopilot";

export type AutopilotOctokit = ReturnType<typeof createOctokit>;
export type AutopilotFindingRow = typeof autopilotFindings.$inferSelect;
export interface AutopilotPullRequestRef {
  owner: string;
  repo: string;
  pullNumber: number;
}
export type AutopilotReadinessReport = AgentReadinessReportView & {
  score: number;
};
export type AutopilotRunTrigger =
  (typeof autopilotRuns.$inferInsert)["trigger"];

export interface AutopilotStopRunInput {
  organizationId: string;
  runId: string;
}
export type BlogFile = z.infer<typeof blogFileSchema>;
export type ReadinessAgentOutput = z.infer<typeof readinessAgentOutputSchema>;
export type AutopilotPullRequestMoment = "ready" | "merged" | "closed";

export interface AutopilotAdminRunFilters {
  organizationId?: string;
  status?: (typeof autopilotRuns.$inferSelect)["status"];
  limit?: number;
  before?: string;
  beforeId?: string;
}

export interface AutopilotPullRequestAuthor {
  headRef: string;
  login?: string | null;
}

export type AutopilotPullRequestSummary = Pick<
  MergedPullRequest,
  "number" | "title" | "url" | "author"
> & { body: string | null };

/** A held finding: only the token holder may write it or move it on. */
export interface FindingClaim {
  finding: AutopilotFindingRow;
  token: string;
}

export type AutopilotProposeMode =
  | { suggestOnly: true }
  | { onUsage: (usage: AgentTokenUsage) => void };

export type AutopilotPostBrief = NonNullable<AutopilotFindingEvidence["brief"]>;

export type AutopilotObservationJob = Exclude<AutopilotJobKind, "readiness">;

export type AutopilotBlogDraft =
  | { kind: "update"; baseSha: string; post: BlogFile; existingPath: string }
  | {
      kind: "new";
      baseSha: string;
      post: BlogFile;
      path: string;
      sample: string | null;
      imageLocation: { path: string; url: string };
    };

export type AutopilotReadinessCheck =
  | { ready: false; reason: string }
  | {
      ready: true;
      targetUrl: string;
      report: AutopilotReadinessReport;
      issues: AgentReadinessIssue[];
    };

export type AutopilotPlanDecision =
  | { outcome: "skip"; memory: null }
  | { outcome: "wait"; memory: AutopilotPlannerState }
  | {
      outcome: "open" | "suggest";
      memory: AutopilotPlannerState;
      topicSlug: string;
      confidence: number | null;
      proposal: AutopilotProposal;
      brief: AutopilotPostBrief;
    };

export interface AutopilotPlanActed {
  findingId: string;
  status: "ready" | "in_progress";
  pullRequestUrl: string | null;
}

export interface AutopilotSchedule {
  briefHour: number;
  timezone: string;
  lastRunAt: Date | null;
}

export interface AutopilotStagedFile {
  path: string;
  content: string;
  issueIds: string[];
  reason: string;
}

export type AutopilotLogFn = (
  message: string,
  data?: AutopilotRunEventData,
  /** Admin-only: prompts, model inputs and outputs. Never shown to users. */
  detail?: AutopilotTraceDetail
) => Promise<void>;

export type AutopilotLogger = Record<AutopilotEventLevel, AutopilotLogFn> & {
  /** Admin-only step, e.g. why one candidate was dropped. Hidden from users. */
  trace: (message: string, detail?: AutopilotTraceDetail) => Promise<void>;
};

/** A content gap the keywords job may turn into a post or a page update. */
export interface AutopilotKeywordCandidate {
  key: string;
  topic: string;
  competitors: string[];
  evidence: string;
  target: AutopilotImpactTarget;
  updatePage: { url: string; title: string } | null;
}

/**
 * Before and after for one pull request. mentions: share of AI answers naming
 * the brand (0 to 1); position: Search Console position (lower is better);
 * score: agent readiness score. after is null until there is data after the merge.
 */
export interface AutopilotImpact {
  metric: "mentions" | "position" | "score";
  before: number | null;
  after: number | null;
}
