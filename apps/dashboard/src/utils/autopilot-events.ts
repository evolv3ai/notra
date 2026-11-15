import {
  AUTOPILOT_AUTOMATION_KINDS,
  AUTOPILOT_SCHEDULED_TRIGGERS,
} from "@notra/db/constants/autopilot";
import type {
  AutopilotEventLevel,
  AutopilotJobKind,
  AutopilotRunEventData,
} from "@notra/db/types/autopilot";

import {
  AUTOPILOT_EVENT_DATA_LABELS,
  AUTOPILOT_RUN_EVENTS_LIVE_REFETCH_MS,
} from "@/constants/autopilot";
import { AUTOPILOT_TEMPLATE_WORKFLOW_KEYS } from "@/constants/workflow-engine";
import type {
  AutopilotRunResult,
  AutopilotRunSectionState,
  AutopilotRunView,
  AutopilotTranscript,
  AutopilotTranscriptStepKind,
} from "@/types/autopilot";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";

export function findActiveAutopilotRun<
  Run extends Pick<AutopilotRunView, "status" | "trigger">,
>(runs: Run[]) {
  return runs.find(
    (run) =>
      run.status === "running" &&
      (AUTOPILOT_SCHEDULED_TRIGGERS as readonly string[]).includes(run.trigger)
  );
}

/** The automation a single-automation run belongs to; null for the daily run. */
export function autopilotRunKind(
  run: Pick<AutopilotRunView, "workflowKey"> | undefined
): AutopilotAutomationKind | null {
  return (
    AUTOPILOT_AUTOMATION_KINDS.find(
      (kind) => AUTOPILOT_TEMPLATE_WORKFLOW_KEYS[kind] === run?.workflowKey
    ) ?? null
  );
}

const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;
const READ_STEP = /^Read (\S+)$/;
const CANDIDATES_STEP = /^\d+ candidates? from /;
const LOOKUP_STEP = /^Looked up /;
const LOOKUP_QUERY_STEP = /^Looked up site pages matching "(.+)"$/;
const OPENED_PULL_REQUEST_STEP = /^Opened pull request #/;
const WWW_PREFIX = /^www\./;
/** Server and browser clocks drift; poll this long past the run's end. */
const RUN_EVENTS_SETTLE_MS = 5000;

const RUN_EVENTS_STOPPED_SETTLE_MS = 3 * 60_000;
const LOG_INLINE_LIST_MAX = 100;

export function formatAutopilotPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** A readable research step, without exposing the raw tool payload. */
export function describeAutopilotToolCall(name: string, input: unknown) {
  const args = (input ?? {}) as { path?: string; url?: string; query?: string };
  if (name === "readFile") {
    return `Read ${args.path}`;
  }
  if (name === "fetchSitemapPage") {
    return `Read ${args.url}`;
  }
  return args.query
    ? `Looked up site pages matching "${args.query}"`
    : "Looked up the site's pages";
}

function formatEventDataLabel(key: string) {
  const label = AUTOPILOT_EVENT_DATA_LABELS[key];
  if (label) {
    return label;
  }
  const words = key.replace(CAMEL_BOUNDARY, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const seconds = ms / 1000;
  return seconds < 60
    ? `${seconds.toFixed(1)} s`
    : `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

function formatEventDataValue(
  key: string,
  value: AutopilotRunEventData[string]
) {
  if (value === null) {
    return "–";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "None";
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([option, share]) => `${option} ${Math.round(share * 100)}%`)
      .join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    if (key === "durationMs") {
      return formatDuration(value);
    }
    if (key === "confidence") {
      return `${Math.round(value * 100)}%`;
    }
    return value.toLocaleString();
  }
  return value;
}

/** Sums token counts across every model call recorded for a run. */
export function sumEventTokens(
  events: { data: AutopilotRunEventData | null }[]
) {
  return events.reduce((total, event) => {
    const input = event.data?.inputTokens;
    const output = event.data?.outputTokens;
    return (
      total +
      (typeof input === "number" ? input : 0) +
      (typeof output === "number" ? output : 0)
    );
  }, 0);
}

const LOG_LEVEL_MARKS: Record<string, string> = {
  action: "✓ ",
  error: "✖ ",
};

/** Event fields that only repeat what the line already says. */
const LOG_HIDDEN_FIELDS = new Set(["event"]);

/** Decision details show the work, while the run keeps model and token details. */
function findingStepLabel(message: string) {
  if (/^Called .+ \(blog-draft\)$/.test(message)) {
    return "Generated a draft";
  }
  if (message === "Rendered the hero image") {
    return "Created the cover image";
  }
  if (message.startsWith("Agent finished with ")) {
    return "Finished the website checks";
  }
  return message;
}

/**
 * The run's events as a build-style log: "HH:MM:SS [job] message", details on
 * indented lines below. Actions read as success, errors as errors.
 */
export function formatRunLog(
  events: {
    job: AutopilotJobKind | null;
    level: string;
    message: string;
    data: AutopilotRunEventData | null;
    createdAt: Date | string;
  }[],
  jobTags: Record<string, string>
) {
  const lines: string[] = [];
  for (const event of events) {
    const time = new Date(event.createdAt).toTimeString().slice(0, 8);
    const tag = jobTags[event.job ?? "run"] ?? "run";
    lines.push(
      `${time} [${tag}] ${LOG_LEVEL_MARKS[event.level] ?? ""}${event.message}`
    );
    for (const [key, value] of Object.entries(event.data ?? {})) {
      if (LOG_HIDDEN_FIELDS.has(key)) {
        continue;
      }
      // Long lists (candidates, what was left out and why) get a line each.
      if (
        Array.isArray(value) &&
        value.join(", ").length > LOG_INLINE_LIST_MAX
      ) {
        lines.push(`    ${formatEventDataLabel(key)}:`);
        lines.push(...value.map((item) => `      · ${item}`));
        continue;
      }
      lines.push(
        `    ${formatEventDataLabel(key)}: ${formatEventDataValue(key, value)}`
      );
    }
  }
  return lines.join("\n");
}

function transcriptStepKind(
  level: AutopilotEventLevel,
  label: string
): AutopilotTranscriptStepKind {
  if (level === "error") {
    return "error";
  }
  if (level === "skip") {
    return "skip";
  }
  if (CANDIDATES_STEP.test(label)) {
    return "gather";
  }
  if (LOOKUP_STEP.test(label)) {
    return "lookup";
  }
  if (label === "Generated a draft") {
    return "draft";
  }
  if (label === "Created the cover image") {
    return "image";
  }
  return "other";
}

/**
 * A run's events as one agent turn: the steps it took (reads in a row fold
 * into one), what it decided, and what it cost. The pull request itself comes
 * from the finding, so its event is left out.
 */
export function toAutopilotTranscript(
  events: {
    id: string;
    level: AutopilotEventLevel;
    message: string;
    data: AutopilotRunEventData | null;
    createdAt: Date | string;
  }[]
): AutopilotTranscript {
  const transcript: AutopilotTranscript = {
    steps: [],
    verdict: null,
    credits: null,
    startedAt: null,
    durationMs: 0,
  };
  for (const event of events) {
    const { data, level, message } = event;
    if (level === "decision" && typeof data?.confidence === "number") {
      transcript.verdict = message;
      continue;
    }
    if (level === "action" && typeof data?.credits === "number") {
      transcript.credits = (transcript.credits ?? 0) + data.credits;
      continue;
    }
    if (level === "action" && OPENED_PULL_REQUEST_STEP.test(message)) {
      continue;
    }
    const read = READ_STEP.exec(message)?.[1];
    const query = LOOKUP_QUERY_STEP.exec(message)?.[1];
    const previous = transcript.steps.at(-1);
    if (query && previous?.type === "lookups") {
      previous.queries.push(query);
      continue;
    }
    if (query) {
      transcript.steps.push({
        type: "lookups",
        id: event.id,
        queries: [query],
      });
      continue;
    }
    if (read && previous?.type === "reads") {
      previous.targets.push(read);
      continue;
    }
    if (read) {
      transcript.steps.push({ type: "reads", id: event.id, targets: [read] });
      continue;
    }
    const label = findingStepLabel(message);
    transcript.steps.push({
      type: "step",
      id: event.id,
      kind: transcriptStepKind(level, label),
      label,
      createdAt: new Date(event.createdAt),
    });
  }
  const first = events.at(0);
  const last = events.at(-1);
  if (first && last) {
    transcript.startedAt = new Date(first.createdAt);
    transcript.durationMs =
      new Date(last.createdAt).getTime() - transcript.startedAt.getTime();
  }
  return transcript;
}

/** "usenotra.com/features" for a URL; repository paths stay as they are. */
export function shortReadTarget(target: string) {
  if (!URL.canParse(target)) {
    return target;
  }
  const url = new URL(target);
  const host = url.hostname.replace(WWW_PREFIX, "");
  return url.pathname === "/" ? host : `${host}${url.pathname}`;
}

/**
 * Polls a run's steps while it runs and until one fetch lands after it
 * finished, so the last steps (pull request, credits) are never missed.
 */
export function runEventsRefetchInterval(
  run: { status: string; finishedAt: Date | string | null } | undefined
) {
  return (query: { state: { dataUpdatedAt: number } }) => {
    if (!run) {
      return false;
    }
    if (run.status === "running" || !run.finishedAt) {
      return AUTOPILOT_RUN_EVENTS_LIVE_REFETCH_MS;
    }
    const settledAt =
      new Date(run.finishedAt).getTime() +
      (run.status === "stopped"
        ? RUN_EVENTS_STOPPED_SETTLE_MS
        : RUN_EVENTS_SETTLE_MS);
    return query.state.dataUpdatedAt < settledAt
      ? AUTOPILOT_RUN_EVENTS_LIVE_REFETCH_MS
      : false;
  };
}

/** How one automation in a run ended: by its last step, not its first. */
export function runSectionState(
  transcript: AutopilotTranscript,
  live: boolean
): AutopilotRunSectionState {
  if (live) {
    return "running";
  }
  const steps = transcript.steps.flatMap((step) =>
    step.type === "step" ? [step] : []
  );
  if (steps.some((step) => step.kind === "error")) {
    return "failed";
  }
  const last = transcript.steps.at(-1);
  return last?.type === "step" && last.kind === "skip" ? "skipped" : "done";
}

/** Keys that stay unique when the same item comes up more than once. */
export function occurrenceKeys(items: string[]) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const count = seen.get(item) ?? 0;
    seen.set(item, count + 1);
    return { item, key: `${item}#${count}` };
  });
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/** What a run came to, in one line for the runs table. */
export function describeRunResult(run: AutopilotRunView): AutopilotRunResult {
  if (run.status === "running") {
    return { tone: "running", text: "Running" };
  }
  if (run.status === "failed") {
    return { tone: "failed", text: run.errorMessage ?? "Failed" };
  }
  if (run.status === "stopped") {
    return { tone: "quiet", text: run.errorMessage ?? "Stopped" };
  }
  // Item runs (a mention, a pull request event) are decided by one log line.
  if (run.outcome) {
    const { level, message } = run.outcome;
    if (OPENED_PULL_REQUEST_STEP.test(message)) {
      return { tone: "pull-request", text: message };
    }
    return { tone: level === "error" ? "error" : "quiet", text: message };
  }
  const proposed = run.summary?.proposed ?? 0;
  const failed = run.summary?.failed ?? 0;
  const ideas = (run.summary?.findings ?? 0) - proposed - failed;
  const parts = [
    ideas > 0 ? plural(ideas, "idea") : null,
    failed > 0 ? `${plural(failed, "draft")} failed` : null,
  ].filter((part) => part !== null);
  if (proposed > 0) {
    return {
      tone: "pull-request",
      text: [`Opened ${plural(proposed, "pull request")}`, ...parts].join(", "),
    };
  }
  if (ideas > 0) {
    return { tone: "ideas", text: `Found ${parts.join(", ")}` };
  }
  if (failed > 0) {
    return { tone: "error", text: `${plural(failed, "draft")} failed` };
  }
  return {
    tone: "quiet",
    text: run.summary?.insights?.[0] ?? "Nothing new",
  };
}
