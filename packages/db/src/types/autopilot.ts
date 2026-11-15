import type {
  AUTOPILOT_EVENT_LEVELS,
  AUTOPILOT_FINDING_STATUSES,
  AUTOPILOT_JOB_KINDS,
  AUTOPILOT_RUN_STATUSES,
} from "../constants/autopilot";

export type AutopilotJobKind = (typeof AUTOPILOT_JOB_KINDS)[number];

export type AutopilotFindingStatus =
  (typeof AUTOPILOT_FINDING_STATUSES)[number];

export type AutopilotRunStatus = (typeof AUTOPILOT_RUN_STATUSES)[number];

export type AutopilotJobs = Record<AutopilotJobKind, boolean>;

/** Which product pull requests "Write about releases" looks at. */
export interface AutopilotCommitFilters {
  /** Lowercase GitHub logins whose pull requests never become a post. */
  excludedAuthors: string[];
  /**
   * Lowercase owner/name to path prefixes or globs. A pull request in a listed
   * repository counts only when one of its changed files matches.
   */
  paths: Record<string, string[]>;
}

export interface AutopilotFindingEvidence {
  sourceUrl?: string | null;
  score?: number | null;
  issueId?: string | null;
  /** Readiness issues this finding addresses; dismissing it stops retrying them. */
  issueIds?: string[];
  keyword?: string | null;
  competitors?: string[];
  pullRequests?: {
    number: number;
    title: string;
    url: string;
    /** GitHub login of who opened it; asked to review the draft. */
    author?: string | null;
  }[];
  detail?: string | null;
  /** Jev's confidence that this is worth a post, 0 to 1. */
  confidence?: number | null;
  /** Notra's offer comment; reactions provide feedback and can dismiss an unwritten suggestion. */
  offerComment?: { repository: string; id: number } | null;
  /** Delivery receipt only; the note itself lives in the workspace memory (feedback.md). */
  feedbackReceipt?: string;
  feedbackPending?: boolean;
  /** Ordering receipts only; the notes live in the workspace memory (feedback.md). */
  feedbackVersions?: Record<string, { commentId: number; updatedAt: string }>;
  /** What the writer gets; stored so a suggestion can be written later. */
  brief?: { topic: string; angle: string; evidence: string } | null;
  /** What a merged pull request is measured on, with the value before it. */
  target?: AutopilotImpactTarget | null;
  /** An existing page the pull request rewrites instead of adding a post. */
  updatePage?: { url: string; title: string } | null;
  /** How Jev chose this over the other candidates of the same run. */
  decision?: AutopilotFindingDecision | null;
  /** Written by the daily run because nobody dismissed the idea in time (before the planner). */
  autoWritten?: boolean;
  /** The planner topic this came from and how many independent signals it had. */
  topic?: { slug: string; title: string; signals: number } | null;
  /** Written because someone asked (a click or a reply), not by the planner alone. */
  requested?: boolean;
  /** Each gate check the planner ran before acting. */
  gate?: { name: string; ok: boolean; detail: string }[] | null;
  /** Failed writes so far; Autopilot gives up after a few. */
  failures?: number;
  /** Claim token holding an automatic draft slot; inert once the claim settles. */
  draftSlot?: string;
  /** States successfully announced in a Slack brief. */
  briefed?: ("suggested" | "proposed")[];
  /**
   * The thread reply for this finding; 👍/👎 on it act on the finding while it
   * is still in the status the reply offered.
   */
  slackMessage?: {
    channel: string;
    ts: string;
    threadTs: string;
    status: "suggested" | "proposed";
  } | null;
  /** When a 👍 action started; another 👍 waits until it settles or goes stale. */
  slackActingAt?: string;
}

export interface AutopilotFindingDecision {
  /** Every candidate Jev compared with its odds, likeliest first. */
  considered: { title: string; share: number }[];
  /** The confidence a pull request needed without anyone asking. */
  threshold: number;
  /** Candidates the filters dropped before Jev saw them. */
  filteredOut: number;
}

/**
 * prompt: share of AI answers that name the brand (0 to 1). search: average
 * Search Console position. Readiness fixes use the report score instead.
 */
export type AutopilotImpactTarget =
  | { kind: "prompt"; promptId: string; before: number }
  | { kind: "search"; query: string; before: number | null };

export interface AutopilotRunSummary {
  findings: number;
  proposed: number;
  failed: number;
  /** Lines worth reading, shown on the Autopilot page and in the brief. */
  insights?: string[];
}

export type AutopilotEventLevel = (typeof AUTOPILOT_EVENT_LEVELS)[number];

export type AutopilotRunEventData = Record<
  string,
  string | number | boolean | null | string[] | Record<string, number>
>;

/** Raw material for the admin console; shape varies by event. */
export type AutopilotTraceDetail = Record<string, unknown>;
