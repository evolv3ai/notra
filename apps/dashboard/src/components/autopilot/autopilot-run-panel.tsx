"use client";

import {
  ArrowDown01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  File02Icon,
  MinusSignCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { TRANSITION } from "@notra/ui/lib/motion";
import {
  AnimatePresence,
  domMax,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useFormatter } from "use-intl";

import { SearchFavicon } from "@/components/ai/chat-activity-group";
import { AgentLoader } from "@/components/icons/agent-loader";
import {
  AUTOPILOT_RUN_SECTION_BADGES,
  AUTOPILOT_TRANSCRIPT_STEP_ICONS,
} from "@/constants/autopilot-ui";
import { ACTIVITY_CONTENT_CLASSNAME } from "@/constants/chat-activity";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";
import type {
  AutopilotLookupsStackProps,
  AutopilotReadsStackProps,
  AutopilotRunPanelProps,
  AutopilotRunSectionHeaderProps,
  AutopilotRunSectionProps,
  AutopilotRunSectionState,
  AutopilotRunStepProps,
} from "@/types/autopilot";
import {
  occurrenceKeys,
  runSectionState,
  shortReadTarget,
  toAutopilotTranscript,
} from "@/utils/autopilot-events";
import { formatElapsedSeconds } from "@/utils/format-elapsed-seconds";

const STEP_ROW_CLASSNAME =
  "text-muted-foreground flex min-w-0 items-center gap-2 text-sm leading-5";
const STACK_TRIGGER_CLASSNAME =
  "text-muted-foreground hover:text-foreground flex w-full min-w-0 items-center gap-2 text-sm transition-colors";
const STACK_LIST_CLASSNAME =
  "border-border/70 mt-1 ml-1.5 flex flex-col gap-1 border-l pl-3";

function hostOf(target: string) {
  return URL.canParse(target) ? new URL(target).hostname : undefined;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <HugeiconsIcon
      aria-hidden="true"
      className={cn(
        "text-muted-foreground/60 size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
        open ? "rotate-180" : "rotate-0"
      )}
      icon={ArrowDown01Icon}
    />
  );
}

function StepLabel({ label, active }: { label: string; active: boolean }) {
  return active ? <Shimmer as="span">{label}</Shimmer> : label;
}

function ReadIcon({ target }: { target: string }) {
  const host = hostOf(target);
  return host ? (
    <SearchFavicon domain={host} />
  ) : (
    <HugeiconsIcon
      aria-hidden="true"
      className="size-3.5 shrink-0"
      icon={File02Icon}
      strokeWidth={1.8}
    />
  );
}

/** Pages read in a row, folded like the chat's search stack. */
function ReadsStack({ targets, active }: AutopilotReadsStackProps) {
  const [open, setOpen] = useState(false);
  const pages = targets.some((target) => hostOf(target));
  const label = `Read ${targets.length} ${pages ? "page" : "file"}${targets.length === 1 ? "" : "s"}`;
  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger className={STACK_TRIGGER_CLASSNAME}>
        <span aria-hidden="true" className="flex shrink-0 -space-x-1">
          {occurrenceKeys(pages ? targets.slice(-3) : targets.slice(-1)).map(
            ({ item: target, key }) => (
              <span
                className="bg-background ring-background flex rounded-full ring-2"
                key={key}
              >
                <ReadIcon target={target} />
              </span>
            )
          )}
        </span>
        <span className="min-w-0 truncate leading-5">
          <StepLabel active={active} label={label} />
        </span>
        <Chevron open={open} />
      </CollapsibleTrigger>
      <CollapsibleContent className={ACTIVITY_CONTENT_CLASSNAME}>
        <ul className={STACK_LIST_CLASSNAME}>
          {occurrenceKeys(targets).map(({ item: target, key }) => (
            <li key={key}>
              {hostOf(target) ? (
                <a
                  className={cn(
                    STEP_ROW_CLASSNAME,
                    "hover:text-foreground transition-colors"
                  )}
                  href={target}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ReadIcon target={target} />
                  <span className="min-w-0 truncate">
                    {shortReadTarget(target)}
                  </span>
                </a>
              ) : (
                <span className={STEP_ROW_CLASSNAME}>
                  <ReadIcon target={target} />
                  <span className="min-w-0 truncate">{target}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Site searches in a row, folded into one line with the queries inside. */
function LookupsStack({ queries, active }: AutopilotLookupsStackProps) {
  const [open, setOpen] = useState(false);
  const icon = (
    <HugeiconsIcon
      aria-hidden="true"
      className="size-3.5 shrink-0"
      icon={AUTOPILOT_TRANSCRIPT_STEP_ICONS.lookup}
      strokeWidth={1.8}
    />
  );
  if (queries.length === 1) {
    return (
      <span className={STEP_ROW_CLASSNAME}>
        {icon}
        <span className="min-w-0 truncate">
          <StepLabel
            active={active}
            label={`Searched the site for "${queries[0]}"`}
          />
        </span>
      </span>
    );
  }
  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger className={STACK_TRIGGER_CLASSNAME}>
        {icon}
        <span className="min-w-0 truncate leading-5">
          <StepLabel
            active={active}
            label={`Searched the site ${queries.length} times`}
          />
        </span>
        <Chevron open={open} />
      </CollapsibleTrigger>
      <CollapsibleContent className={ACTIVITY_CONTENT_CLASSNAME}>
        <ul className={STACK_LIST_CLASSNAME}>
          {occurrenceKeys(queries).map(({ item: query, key }) => (
            <li className={STEP_ROW_CLASSNAME} key={key}>
              {icon}
              <span className="min-w-0 truncate">{query}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A run as one framed agent panel; each automation is a section of it. */
export function AutopilotRunPanel({ children }: AutopilotRunPanelProps) {
  return (
    <div className={TABLE_FRAME_CLASS}>
      <LazyMotion features={domMax}>
        <div className={cn(TABLE_BODY_CLASS, "divide-y overflow-hidden")}>
          {children}
        </div>
      </LazyMotion>
    </div>
  );
}

const SECTION_STATE_ICONS: Record<
  Exclude<AutopilotRunSectionState, "running">,
  IconSvgElement
> = {
  done: CheckmarkCircle02Icon,
  skipped: MinusSignCircleIcon,
  failed: Cancel01Icon,
};

/** The section's state icon, name, duration and badge. */
function RunSectionHeader({
  id,
  label,
  state,
  seconds,
}: AutopilotRunSectionHeaderProps) {
  const badge = AUTOPILOT_RUN_SECTION_BADGES[state];
  return (
    <div className="flex min-w-0 items-center gap-3">
      {state === "running" ? (
        <AgentLoader active className="text-foreground/75 size-4 shrink-0" />
      ) : (
        <HugeiconsIcon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0",
            state === "failed" ? "text-destructive" : "text-muted-foreground"
          )}
          icon={SECTION_STATE_ICONS[state]}
          strokeWidth={1.5}
        />
      )}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium" id={`${id}-label`}>
          {label}
        </h3>
        {seconds === null ? null : (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatElapsedSeconds(seconds)}
          </span>
        )}
      </div>
      <StatusBadge appearance={badge.appearance} label={badge.label} />
    </div>
  );
}

/** One step row; reads and searches in a row are folded stacks. */
function RunStep({ step, active }: AutopilotRunStepProps) {
  const format = useFormatter();
  if (step.type === "reads") {
    return <ReadsStack active={active} targets={step.targets} />;
  }
  if (step.type === "lookups") {
    return <LookupsStack active={active} queries={step.queries} />;
  }
  return (
    <span
      className={cn(
        STEP_ROW_CLASSNAME,
        step.kind === "error" && "text-destructive"
      )}
      title={format.dateTime(step.createdAt, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3.5 shrink-0"
        icon={AUTOPILOT_TRANSCRIPT_STEP_ICONS[step.kind]}
        strokeWidth={1.8}
      />
      {step.kind === "error" ? <span className="sr-only">Error: </span> : null}
      <span className="min-w-0 break-words">
        <StepLabel active={active} label={step.label} />
      </span>
    </span>
  );
}

/**
 * One automation inside a run panel: a header with its state and how long it
 * took, then its steps in the chat's activity style, what it concluded and
 * what it made. While `live`, new steps slide in, the latest one shimmers
 * and the duration counts up.
 */
export function AutopilotRunSection({
  id,
  label,
  events,
  live,
  children,
  result,
}: AutopilotRunSectionProps) {
  const reduceMotion = useReducedMotion();
  const now = useNow(live, 1000);
  // The server's clock would not match the first client render.
  const isClient = useIsClient();
  const transcript = toAutopilotTranscript(events);
  const state = runSectionState(transcript, live);
  let seconds: number | null = Math.max(
    1,
    Math.round(transcript.durationMs / 1000)
  );
  if (state === "skipped") {
    seconds = null;
  } else if (live) {
    seconds =
      isClient && transcript.startedAt
        ? Math.max(0, Math.floor((now - transcript.startedAt.getTime()) / 1000))
        : null;
  }
  const lastStepId = transcript.steps.at(-1)?.id;

  return (
    <section aria-labelledby={`${id}-label`} className="px-5 py-4">
      <RunSectionHeader id={id} label={label} seconds={seconds} state={state} />

      <div className="border-border/70 mt-3 ml-2 flex flex-col gap-3 border-l pl-5">
        {transcript.steps.length === 0 && live ? (
          <p className={STEP_ROW_CLASSNAME}>
            <Shimmer as="span">Starting</Shimmer>
          </p>
        ) : null}
        {transcript.steps.length > 0 ? (
          <ol aria-label="Steps" className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {transcript.steps.map((step) => (
                <m.li
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  initial={{
                    opacity: 0,
                    transform: reduceMotion ? "none" : "translateY(4px)",
                  }}
                  key={step.id}
                  transition={TRANSITION.enter}
                >
                  <RunStep
                    active={live && step.id === lastStepId}
                    step={step}
                  />
                </m.li>
              ))}
            </AnimatePresence>
          </ol>
        ) : null}

        {transcript.verdict || children ? (
          <div className="text-foreground animate-in fade-in max-w-3xl space-y-2 text-sm text-pretty duration-300 motion-reduce:animate-none">
            {transcript.verdict ? <p>{transcript.verdict}.</p> : null}
            {children}
          </div>
        ) : null}

        {result}

        {transcript.credits ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3.5 shrink-0"
              icon={Coins01Icon}
              strokeWidth={1.8}
            />
            {transcript.credits} credits
          </p>
        ) : null}
      </div>
    </section>
  );
}
