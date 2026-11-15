"use client";

import { useFlag } from "@databuddy/sdk/react";
import { GitPullRequestIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { TABLE_FRAME_CLASS } from "ui/table/constants";
import { useFormatter } from "use-intl";

import { AutopilotBackLink } from "@/components/autopilot/autopilot-back-link";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import {
  AutopilotRunPanel,
  AutopilotRunSection,
} from "@/components/autopilot/autopilot-run-panel";
import { AutopilotRunTimeline } from "@/components/autopilot/autopilot-run-timeline";
import { AutopilotStopButton } from "@/components/autopilot/autopilot-stop-button";
import { AutopilotWorkflowGraph } from "@/components/autopilot/autopilot-workflow-graph";
import { EmptyState } from "@/components/empty-state";
import { SiteBuildLogs } from "@/components/sites/site-build-logs";
import {
  AUTOPILOT_CREDITS_CHARGED_EVENT,
  AUTOPILOT_RUN_LOG_TAGS,
  AUTOPILOT_RUN_SECTIONS,
  AUTOPILOT_RUN_STATUS_BADGES,
  AUTOPILOT_RUN_TRIGGER_LABELS,
  AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY,
} from "@/constants/autopilot";
import { AUTOPILOT_RUN_RESULT_CLASS } from "@/constants/autopilot-ui";
import { SITE_DEPLOYMENT_LOG_SURFACE_CLASS } from "@/constants/sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type {
  AutopilotRunEndNoticeProps,
  AutopilotRunLogProps,
  AutopilotRunPageClientProps,
  AutopilotRunPageProps,
  AutopilotRunSummaryProps,
  AutopilotRunTurnResultProps,
} from "@/types/autopilot";
import {
  formatDuration,
  formatRunLog,
  runEventsRefetchInterval,
  sumEventTokens,
} from "@/utils/autopilot-events";

export default function PageClient({
  organizationSlug,
  runId,
}: AutopilotRunPageClientProps) {
  return (
    <AutopilotPageShell organizationSlug={organizationSlug}>
      {({ organizationId, overview }) => {
        const run = overview.runs.find((row) => row.id === runId);
        return run ? (
          <RunPage
            canManage={overview.canManage}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            run={run}
          />
        ) : (
          <>
            <AutopilotBackLink slug={organizationSlug} tab="analytics" />
            <EmptyState
              description="This run is older than the runs Autopilot keeps on the page."
              title="Run not found"
            />
          </>
        );
      }}
    </AutopilotPageShell>
  );
}

function RunSummary({ events, run }: AutopilotRunSummaryProps) {
  const format = useFormatter();
  const tokens = sumEventTokens(events);
  const credits = events.reduce(
    (total, event) =>
      event.data?.event === AUTOPILOT_CREDITS_CHARGED_EVENT &&
      typeof event.data.credits === "number"
        ? total + event.data.credits
        : total,
    0
  );
  const startedAt = new Date(run.startedAt);
  const status = AUTOPILOT_RUN_STATUS_BADGES[run.status];
  const proposed = run.summary?.proposed ?? 0;

  return (
    <ul
      aria-label="Run summary"
      className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm tabular-nums"
    >
      <li>
        <StatusBadge appearance={status.appearance} label={status.label} />
      </li>
      {run.finishedAt ? (
        <li>
          Took{" "}
          {formatDuration(
            new Date(run.finishedAt).getTime() - startedAt.getTime()
          )}
        </li>
      ) : null}
      <li>
        {proposed} pull request{proposed === 1 ? "" : "s"}
      </li>
      <li>{format.number(tokens, { notation: "compact" })} tokens</li>
      <li>
        {credits} credit{credits === 1 ? "" : "s"}
      </li>
    </ul>
  );
}

function RunEndNotice({ run }: AutopilotRunEndNoticeProps) {
  if (!run.errorMessage) {
    return null;
  }
  return (
    <p
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        run.status === "stopped"
          ? "text-muted-foreground bg-muted/40"
          : "text-destructive bg-destructive/5"
      )}
    >
      {run.errorMessage}
    </p>
  );
}

function RunTurnResult({ events }: AutopilotRunTurnResultProps) {
  const opened = events.findLast(
    (event) => event.level === "action" && typeof event.data?.url === "string"
  );
  const url = opened?.data?.url;
  if (!(opened && typeof url === "string")) {
    return null;
  }
  const title = opened.data?.title;
  return (
    <a
      className={cn(
        AUTOPILOT_RUN_RESULT_CLASS,
        "hover:bg-muted/70 transition-colors"
      )}
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground size-4 shrink-0"
        icon={GitPullRequestIcon}
        strokeWidth={1.5}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {typeof title === "string" ? title : opened.message}
      </span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {opened.message.replace("Opened pull request ", "")}
      </span>
    </a>
  );
}

function RunLog({ events, pending, run }: AutopilotRunLogProps) {
  const running = run.status === "running";
  return (
    <section aria-labelledby="run-log" className="space-y-3">
      <h2 className="text-sm font-medium" id="run-log">
        Log
      </h2>
      <div className={TABLE_FRAME_CLASS}>
        <div className={SITE_DEPLOYMENT_LOG_SURFACE_CLASS}>
          {events.length > 0 ? (
            <div className="p-4">
              <AutopilotRunTimeline events={events} run={run} />
            </div>
          ) : null}
          <div className={events.length > 0 ? "border-t p-4" : "p-4"}>
            {pending ? <Skeleton className="h-48 rounded-lg" /> : null}
            {!pending && events.length === 0 && !running ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No steps were recorded for this run.
              </p>
            ) : null}
            {pending || (events.length === 0 && !running) ? null : (
              <SiteBuildLogs
                inProgress={running}
                log={
                  events.length > 0
                    ? formatRunLog(events, AUTOPILOT_RUN_LOG_TAGS)
                    : null
                }
                queued={false}
                title="Log"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RunPage({
  canManage,
  organizationId,
  organizationSlug,
  run,
}: AutopilotRunPageProps) {
  const format = useFormatter();
  const graphFlag = useFlag(AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY);
  const showGraph =
    Boolean(run.workflowKey) &&
    (graphFlag.on || process.env.NODE_ENV === "development");
  const running = run.status === "running";
  const query = useQuery(
    dashboardOrpc.autopilot.runEvents.queryOptions({
      input: { organizationId, runId: run.id },
      refetchInterval: runEventsRefetchInterval(run),
    })
  );
  const events = query.data ?? [];
  const turns = AUTOPILOT_RUN_SECTIONS.flatMap((section) => {
    const own = events.filter((event) => event.job === section.job);
    const first = own[0];
    return first
      ? [
          {
            job: section.job,
            label: section.label,
            events: own,
            startedAt: first.createdAt,
            lastAt: new Date(
              own.at(-1)?.createdAt ?? first.createdAt
            ).getTime(),
          },
        ]
      : [];
  }).sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
  const latest = Math.max(...turns.map((turn) => turn.lastAt));
  const startedAt = new Date(run.startedAt);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <AutopilotBackLink slug={organizationSlug} tab="analytics" />
        <PageHeading
          description={[
            run.headline ? AUTOPILOT_RUN_TRIGGER_LABELS[run.trigger] : null,
            format.dateTime(startedAt, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          ]
            .filter(Boolean)
            .join(" · ")}
          title={run.headline ?? AUTOPILOT_RUN_TRIGGER_LABELS[run.trigger]}
        >
          {canManage && running && run.workflowKey ? (
            <AutopilotStopButton
              organizationId={organizationId}
              runId={run.id}
            />
          ) : null}
        </PageHeading>
        <RunSummary events={events} run={run} />
      </div>

      <RunEndNotice run={run} />

      {showGraph ? (
        <section aria-labelledby="run-workflow" className="space-y-3">
          <h2 className="text-sm font-medium" id="run-workflow">
            Workflow
          </h2>
          <AutopilotWorkflowGraph organizationId={organizationId} run={run} />
        </section>
      ) : null}

      <section aria-labelledby="run-activity" className="space-y-3">
        <h2 className="text-sm font-medium" id="run-activity">
          Activity
        </h2>
        {query.isPending ? <Skeleton className="h-32 rounded-2xl" /> : null}
        {query.isPending || (turns.length === 0 && !running) ? null : (
          <AutopilotRunPanel>
            {turns.length === 0 ? (
              <AutopilotRunSection
                events={[]}
                id={`${run.id}-start`}
                label="Autopilot"
                live
              />
            ) : null}
            {turns.map((turn) => (
              <AutopilotRunSection
                events={turn.events}
                id={`${run.id}-${turn.job ?? "run"}`}
                key={turn.job ?? "run"}
                label={turn.label}
                live={running && turn.lastAt === latest}
                result={<RunTurnResult events={turn.events} />}
              />
            ))}
          </AutopilotRunPanel>
        )}
      </section>

      <RunLog events={events} pending={query.isPending} run={run} />
    </div>
  );
}
