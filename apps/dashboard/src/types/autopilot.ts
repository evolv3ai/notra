import type { IconSvgElement } from "@hugeicons/react";
import type { AutopilotObservation } from "@notra/ai/types/autopilot-planner";
import type {
  AutopilotCommitFilters,
  AutopilotFindingEvidence,
  AutopilotJobKind,
} from "@notra/db/types/autopilot";
import type { InferRouterOutputs } from "@orpc/server";
import type { ReactNode } from "react";
import type * as z from "zod";

import type {
  AUTOPILOT_PAGE_TABS,
  AUTOPILOT_SETUP_STEP_IDS,
} from "@/constants/autopilot-ui";
import type { useAutopilotSetup } from "@/lib/hooks/use-autopilot-setup";
import type { DashboardRouter } from "@/lib/orpc/router";
import type { autopilotPullRequestEventSchema } from "@/schemas/autopilot-github";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type { GitHubMergeMethod } from "@/types/integrations/github";
import type { WorkflowRunView } from "@/types/workflow-engine";

export interface AutopilotRepository {
  owner: string;
  name: string;
  branch: string;
}

export interface AutopilotRunContext {
  organizationId: string;
  organizationSlug: string;
  runId: string;
  projectId: string | null;
  repository: AutopilotRepository | null;
  contentPath: string | null;
  jobs: Record<AutopilotJobKind, boolean>;
  maxOpenPullRequests: number;
  /** Untouched drafts are closed after this many days; null keeps them. */
  stalePullRequestDays: number | null;
  /** Which product pull requests the commits job reads. */
  commitFilters: AutopilotCommitFilters;
  brand: {
    name: string;
    websiteUrl: string;
    description: string;
    audience: string | null;
    language: string;
    /** Brand house rules from the identity settings; the writer follows them. */
    customInstructions: string | null;
    /** brand_settings id, for the brand's colors and logo. */
    settingsId: string;
  } | null;
}

export interface AutopilotProposal {
  kind: AutopilotJobKind;
  fingerprint: string;
  title: string;
  summary: string;
  evidence: AutopilotFindingEvidence;
}

export type AutopilotPullRequestEvent = z.infer<
  typeof autopilotPullRequestEventSchema
>;

export interface MergedPullRequest {
  /** owner/name */
  repository: string;
  number: number;
  title: string;
  url: string;
  /** Whitespace-collapsed and clipped for prompts. */
  body: string;
  /** GitHub login of who opened it. */
  author: string | null;
}

export interface AutopilotJobResult {
  findingIds: string[];
  /** Lines worth showing in the brief. */
  insights: string[];
  /** What keywords and commits noticed; the planner decides what to do with it. */
  observations?: AutopilotRunObservation[];
}

/** An observation plus what Autopilot needs to act on it later in the run. */
export interface AutopilotRunObservation extends AutopilotObservation {
  proposal: AutopilotProposal;
  brief: NonNullable<AutopilotFindingEvidence["brief"]>;
}

export interface AutopilotSuggestionWorkflowPayload {
  organizationId: string;
  findingId: string;
  /** Run created at enqueue time; internal callers may omit it. */
  runId?: string;
}

export interface AutopilotPullRequestWorkflowPayload {
  deliveryId: string;
  rawBody: string;
}

type AutopilotOverview =
  InferRouterOutputs<DashboardRouter>["autopilot"]["get"];

export type AutopilotSettingsView = AutopilotOverview["settings"];

export type AutopilotFindingView = AutopilotOverview["findings"][number];

export type AutopilotRunView = AutopilotOverview["runs"][number];

export interface AutopilotSetupFormProps {
  organizationId: string;
  callbackPath: string;
  overview: AutopilotOverview;
  /** Project in scope; used only until Autopilot has a saved project. */
  projectId?: string | null;
  submitLabel: string;
  onSaved?: () => void;
}

export interface AutopilotPageClientProps {
  organizationSlug: string;
}

type AutopilotRunEventView =
  InferRouterOutputs<DashboardRouter>["autopilot"]["runEvents"][number];

export interface AutopilotRunsTableProps {
  runs: AutopilotRunView[];
  onSelect: (run: AutopilotRunView) => void;
}

export interface AutopilotRunResult {
  tone: "running" | "failed" | "error" | "pull-request" | "ideas" | "quiet";
  text: string;
}

export interface AutopilotPendingFindingAction {
  kind: "merge" | "dismiss";
  finding: AutopilotFindingView;
}

export interface AutopilotFindingConfirmDialogProps {
  organizationId: string;
  pending: AutopilotPendingFindingAction | null;
  branch: string | null;
  onClose: () => void;
}

export interface AutopilotAutomationPageClientProps {
  organizationSlug: string;
  automation: string;
}

export interface AutopilotOverviewPageProps {
  organizationId: string;
  organizationSlug: string;
  overview: AutopilotOverview;
}

export interface AutopilotAutomationPageProps {
  kind: AutopilotAutomationKind;
  organizationId: string;
  organizationSlug: string;
  overview: AutopilotOverview;
}

export interface AutopilotAutomationStatusProps {
  kind: AutopilotAutomationKind;
  overview: AutopilotOverview;
  merging: boolean;
  onMerge: (finding: AutopilotFindingView, method: GitHubMergeMethod) => void;
}

export interface AutopilotTrendProps {
  current: number;
  previous: number | undefined;
  /** Credits cost more when they rise, so a rise reads as worse. */
  higherIsBetter?: boolean;
}

export interface AutopilotAutomationFactsProps {
  kind: AutopilotAutomationKind;
  settings: AutopilotSettingsView;
}

export type AutopilotJobDecisionView =
  InferRouterOutputs<DashboardRouter>["autopilot"]["jobDecisions"][number];

export interface AutopilotJobDecisionsProps {
  kind: AutopilotAutomationKind;
  organizationId: string;
  organizationSlug: string;
}

export interface AutopilotFindingPageClientProps {
  organizationSlug: string;
  findingId: string;
}

export interface AutopilotFindingPageProps {
  organizationId: string;
  organizationSlug: string;
  overview: AutopilotOverview;
  finding: AutopilotFindingView;
}

export interface AutopilotFindingSourceProps {
  finding: AutopilotFindingView;
}

export interface AutopilotFindingSourceRowProps {
  icon: IconSvgElement;
  title: string;
  /** Joined with dots; nulls are left out. */
  meta: (string | null)[];
  href?: string;
}

export interface AutopilotFindingSourceBlockProps {
  label: string;
  children: ReactNode;
}

/** One piece of a pull request body on the idea page. */
/** `line` is where it starts in the source text and doubles as its key. */
export type AutopilotSourceBlock =
  | { type: "heading"; line: number; text: string }
  | { type: "paragraph"; line: number; text: string }
  | { type: "code"; line: number; text: string }
  | { type: "list"; line: number; items: { line: number; text: string }[] };

/** A run of text, or of code between backticks, at `offset` in its line. */
export interface AutopilotInlineSegment {
  offset: number;
  text: string;
  code: boolean;
}

export interface AutopilotSourceDescriptionProps {
  label: string;
  text: string;
}

export interface AutopilotSourceTextProps {
  text: string;
}

export interface AutopilotFindingCandidate {
  title: string;
  share: number;
  picked: boolean;
}

export interface AutopilotSetupRowProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}

export type AutopilotRepositoryOption =
  InferRouterOutputs<DashboardRouter>["autopilot"]["repositories"][number];

export interface AutopilotRepositoryPickerProps {
  id?: string;
  repositories: AutopilotRepositoryOption[];
  /** owner/name of the chosen repository. */
  value: string | null;
  onChange: (repository: AutopilotRepositoryOption) => void;
  className?: string;
  /** Defaults to the website repository's label and prompt. */
  label?: string;
  placeholder?: string;
}

type AutopilotSetupState = ReturnType<typeof useAutopilotSetup>;

export interface AutopilotSetupRowsProps {
  setup: AutopilotSetupState;
}

export type AutopilotSetupStepId = (typeof AUTOPILOT_SETUP_STEP_IDS)[number];

export interface AutopilotRunPageClientProps {
  organizationSlug: string;
  runId: string;
}

export interface AutopilotStopButtonProps {
  organizationId: string;
  runId: string;
}

export interface AutopilotRunTurnResultProps {
  events: AutopilotRunEventView[];
}

export interface AutopilotRunLogProps {
  events: AutopilotRunEventView[];
  pending: boolean;
  run: AutopilotRunView;
}

export interface AutopilotRunEndNoticeProps {
  run: AutopilotRunView;
}

export interface AutopilotRunSummaryProps {
  events: AutopilotRunEventView[];
  run: AutopilotRunView;
}

export interface AutopilotWorkflowGraphProps {
  organizationId: string;
  run: AutopilotRunView;
}

export interface WorkflowRunCanvasProps {
  run: WorkflowRunView;
  calledFrom: string | null;
  now: number;
}

export interface AutopilotRunPageProps {
  canManage: boolean;
  organizationId: string;
  organizationSlug: string;
  run: AutopilotRunView;
}

export interface AutopilotFactProps {
  label: string;
  children: ReactNode;
}

export interface AutopilotRunTimelineProps {
  run: AutopilotRunView;
  events: AutopilotRunEventView[];
}

export interface AutopilotFindingTranscriptProps {
  finding: AutopilotFindingView;
  events: AutopilotRunEventView[];
  /** Why Autopilot made it, as the agent's answer below its steps. */
  children: ReactNode;
}

export type AutopilotRunSectionState =
  | "running"
  | "done"
  | "skipped"
  | "failed";

export interface AutopilotRunSectionProps {
  id: string;
  /** The automation's name, e.g. "Write about releases". */
  label: string;
  events: AutopilotRunEventView[];
  /** Still running: new steps slide in and the duration counts up. */
  live: boolean;
  /** More of what the agent concluded, after what it decided. */
  children?: ReactNode;
  /** What it made, e.g. the pull request. */
  result?: ReactNode;
}

export interface AutopilotRunSectionHeaderProps {
  id: string;
  label: string;
  state: AutopilotRunSectionState;
  /** Null hides the duration: skipped, or live before the clock is known. */
  seconds: number | null;
}

export interface AutopilotRunStepProps {
  step: AutopilotTranscriptStep;
  active: boolean;
}

export interface AutopilotRunPanelProps {
  children: ReactNode;
}

export interface AutopilotLookupsStackProps {
  queries: string[];
  active: boolean;
}

export interface AutopilotReadsStackProps {
  targets: string[];
  active: boolean;
}

/** What a step did, for its icon. */
export type AutopilotTranscriptStepKind =
  | "gather"
  | "lookup"
  | "draft"
  | "image"
  | "skip"
  | "error"
  | "other";

/** One line of a run read as an agent turn; consecutive reads fold into one. */
type AutopilotTranscriptStep =
  | { type: "reads"; id: string; targets: string[] }
  | { type: "lookups"; id: string; queries: string[] }
  | {
      type: "step";
      id: string;
      kind: AutopilotTranscriptStepKind;
      label: string;
      createdAt: Date;
    };

export interface AutopilotTranscript {
  steps: AutopilotTranscriptStep[];
  /** The pick and how sure Jev was, said by the agent rather than listed. */
  verdict: string | null;
  credits: number | null;
  startedAt: Date | null;
  durationMs: number;
}

export interface AutopilotTableEmptyProps {
  icon: IconSvgElement;
  title: string;
  description: string;
  action?: ReactNode;
}

export interface AutopilotMergeMenuProps {
  size?: "xs" | "sm";
  loading?: boolean;
  onMerge: (method: GitHubMergeMethod) => void;
}

export interface AutopilotFindingStatusProps {
  finding: AutopilotFindingView;
}

export interface AutopilotStatStripProps {
  stats: {
    label: string;
    value: number | string | null | undefined;
    trend?: ReactNode;
  }[];
  busy?: boolean;
}

export interface AutopilotBackLinkProps {
  slug: string;
  tab?: (typeof AUTOPILOT_PAGE_TABS)[number];
}

export interface AutopilotPageShellProps {
  organizationSlug: string;
  children: (context: {
    organizationId: string;
    overview: AutopilotOverview;
  }) => ReactNode;
}

export interface AutopilotPullRequestsTableProps {
  findings: AutopilotFindingView[];
  /** Ideas show that they wait for someone instead of the pull request status. */
  view?: "pull-requests" | "ideas";
  readOnly: boolean;
  /** Off on an automation's own page, where every row has the same one. */
  showAutomation?: boolean;
  /** The idea a Write click is starting, shown without its buttons. */
  writingId: string | null;
  onOpen: (finding: AutopilotFindingView) => void;
  /** The pull request a merge is running for, shown loading. */
  mergingId: string | null;
  onMerge: (finding: AutopilotFindingView, method: GitHubMergeMethod) => void;
  onWrite?: (finding: AutopilotFindingView) => void;
}

export interface AutopilotFindingTablesProps extends Omit<
  AutopilotPullRequestsTableProps,
  "findings" | "view"
> {
  findings: AutopilotFindingView[];
  /** Prefix for the section heading ids, unique per page. */
  idPrefix: string;
}

export interface AutopilotSettingsRowProps {
  icon: IconSvgElement;
  label: string;
  description?: string;
  htmlFor: string;
  children: ReactNode;
}

export interface AutopilotSettingsPanelProps {
  organizationId: string;
  callbackPath: string;
  overview: AutopilotOverview;
}

/** Someone who opened pull requests in the watched repositories lately. */
export interface AutopilotAuthorSuggestion {
  login: string;
  /** A GitHub App or bot account. */
  bot: boolean;
  pullRequests: number;
  /** How many of them had a chore, CI or bump title. */
  chores: number;
}

export interface AutopilotTagInputProps {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** The entry as stored, or null when it is not valid. */
  parse: (value: string) => string | null;
  placeholder?: string;
  label: string;
  disabled?: boolean;
  /** Offered while typing, matched by prefix; added values are left out. */
  suggestions?: string[];
  /** Splits pasted or typed text into entries; whitespace and commas by default. */
  separator?: RegExp;
}

export interface AutopilotReleaseFiltersSectionProps {
  organizationId: string;
  githubConnected: boolean;
  filters: AutopilotCommitFilters;
  repositories: AutopilotRepositoryOption[];
}

export interface AutopilotRulesSectionProps {
  organizationId: string;
  rules: AutopilotOverview["rules"];
}
