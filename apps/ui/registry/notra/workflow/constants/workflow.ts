import {
  FlagIcon,
  GitForkIcon,
  HourglassIcon,
  MailIcon,
  MergeIcon,
  PlugIcon,
  RepeatIcon,
  SparklesIcon,
  SplitIcon,
  SquareFunctionIcon,
  UserCheckIcon,
  ZapIcon,
} from "lucide-react";

import type {
  WorkflowKindConfig,
  WorkflowModel,
  WorkflowNodeKind,
  WorkflowNodeStatus,
  WorkflowPort,
  WorkflowStatusConfig,
} from "../types/workflow";

export const WORKFLOW_DEFAULT_DURATION_MS = 900;

export const WORKFLOW_EDGE_TRAVEL_MS = 450;

export const WORKFLOW_TICK_MS = 50;

export const WORKFLOW_BLOCK_MIME = "application/x-workflow-block";

export const WORKFLOW_IN_PORT: WorkflowPort = { id: "in" };

export const WORKFLOW_OUT_PORT: WorkflowPort = { id: "out" };

export const WORKFLOW_KINDS: Record<WorkflowNodeKind, WorkflowKindConfig> = {
  ai: {
    icon: SparklesIcon,
    label: "AI step",
    tileClassName:
      "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300",
  },
  approval: {
    icon: UserCheckIcon,
    label: "Human approval",
    tileClassName:
      "bg-pink-500/10 text-pink-600 ring-pink-500/20 dark:text-pink-300",
  },
  condition: {
    icon: SplitIcon,
    label: "If / else",
    tileClassName:
      "bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-300",
  },
  delay: {
    icon: HourglassIcon,
    label: "Wait",
    tileClassName:
      "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-300",
  },
  email: {
    icon: MailIcon,
    label: "Email",
    tileClassName:
      "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300",
  },
  integration: {
    icon: PlugIcon,
    label: "Integration",
    tileClassName:
      "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300",
  },
  loop: {
    icon: RepeatIcon,
    label: "For each",
    tileClassName:
      "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300",
  },
  merge: {
    icon: MergeIcon,
    label: "Merge",
    tileClassName:
      "bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-300",
  },
  output: {
    icon: FlagIcon,
    label: "Output",
    tileClassName:
      "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-300",
  },
  switch: {
    icon: GitForkIcon,
    label: "Decision",
    tileClassName:
      "bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-300",
  },
  task: {
    icon: SquareFunctionIcon,
    label: "Task",
    tileClassName:
      "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-300",
  },
  trigger: {
    icon: ZapIcon,
    label: "Trigger",
    tileClassName:
      "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300",
  },
};

export const WORKFLOW_NON_DETERMINISTIC_KINDS: WorkflowNodeKind[] = ["ai"];

export const WORKFLOW_STATUSES: Record<
  WorkflowNodeStatus,
  WorkflowStatusConfig
> = {
  error: {
    className: "text-red-600 dark:text-red-400",
    label: "Failed",
    ledClassName: "bg-red-500 shadow-[0_0_6px_var(--color-red-500)]",
  },
  idle: {
    className: "text-muted-foreground",
    label: "Idle",
    ledClassName: "bg-muted-foreground/35",
  },
  queued: {
    className: "text-muted-foreground",
    label: "Queued",
    ledClassName: "bg-muted-foreground/35",
  },
  running: {
    className: "text-primary",
    label: "Running",
    ledClassName:
      "bg-primary shadow-[0_0_6px_var(--color-primary,var(--primary))] motion-safe:animate-pulse",
  },
  skipped: {
    className: "text-muted-foreground",
    label: "Skipped",
    ledClassName: "bg-muted-foreground/20",
  },
  success: {
    className: "text-emerald-600 dark:text-emerald-400",
    label: "Completed",
    ledClassName: "bg-emerald-500 shadow-[0_0_6px_var(--color-emerald-500)]",
  },
  waiting: {
    className: "text-amber-600 dark:text-amber-400",
    label: "Waiting for approval",
    ledClassName:
      "bg-amber-500 shadow-[0_0_6px_var(--color-amber-500)] motion-safe:animate-pulse",
  },
};

export const WORKFLOW_NODE_RING: Record<WorkflowNodeStatus, string> = {
  error: "border-red-500/60",
  idle: "",
  queued: "",
  running:
    "border-primary shadow-[0_0_0_0.3rem_color-mix(in_oklab,var(--color-primary,var(--primary))_14%,transparent)]",
  skipped: "",
  success: "border-emerald-500/50",
  waiting:
    "border-amber-500 shadow-[0_0_0_0.3rem_color-mix(in_oklab,var(--color-amber-500)_14%,transparent)]",
};

export const WORKFLOW_MODELS: WorkflowModel[] = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    logo: "claude",
    provider: "Anthropic",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    logo: "claude",
    provider: "Anthropic",
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    logo: "claude",
    provider: "Anthropic",
  },
  { id: "gpt-5", label: "GPT-5", logo: "openai", provider: "OpenAI" },
  { id: "gpt-5-mini", label: "GPT-5 mini", logo: "openai", provider: "OpenAI" },
  {
    id: "gemini-2-5-pro",
    label: "Gemini 2.5 Pro",
    logo: "gemini",
    provider: "Google",
  },
  {
    id: "sonar-pro",
    label: "Sonar Pro",
    logo: "perplexity",
    provider: "Perplexity",
  },
  { id: "grok-4", label: "Grok 4", logo: "grok", provider: "xAI" },
  {
    id: "mistral-large",
    label: "Mistral Large",
    logo: "mistral",
    provider: "Mistral",
  },
  {
    id: "deepseek-v3",
    label: "DeepSeek V3",
    logo: "deepseek",
    provider: "DeepSeek",
  },
];
