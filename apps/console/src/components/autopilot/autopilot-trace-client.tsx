"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { AutopilotTraceEvents } from "@/components/autopilot/autopilot-trace-events";
import { AutopilotTraceFindings } from "@/components/autopilot/autopilot-trace-findings";
import { AutopilotTraceSummary } from "@/components/autopilot/autopilot-trace-summary";
import { Button } from "@/components/button";
import { AUTOPILOT_ADMIN_POLL_MS } from "@/constants/autopilot";
import { consoleOrpc } from "@/lib/orpc/query";
import type { AutopilotTracePageProps } from "@/types/autopilot";

export function AutopilotTraceClient({ slug, runId }: AutopilotTracePageProps) {
  const [includeDetail, setIncludeDetail] = useState(false);
  const query = useQuery({
    gcTime: 0,
    ...consoleOrpc.autopilot.trace.queryOptions({
      input: { runId, includeDetail },
    }),
    refetchInterval: (current) =>
      current.state.data?.run.status === "running"
        ? AUTOPILOT_ADMIN_POLL_MS
        : false,
  });
  const trace = query.data;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <Link
        className="text-muted-foreground w-fit text-sm underline underline-offset-4"
        href={`/${slug}/autopilot`}
      >
        Back to Autopilot runs
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Autopilot run</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm break-all">
          {runId}
        </p>
      </header>
      {query.isPending ? <p role="status">Loading run…</p> : null}
      {query.isError ? (
        <div role="alert">
          <p>
            Could not load this run. It may not exist, or the dashboard is
            unavailable.
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
      {trace ? (
        <>
          <AutopilotTraceSummary trace={trace} />
          <AutopilotTraceFindings findings={trace.findings} />
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Decision trace</h2>
              <Button
                variant="outline"
                disabled={trace.detailExpired || query.isFetching}
                onClick={() => setIncludeDetail((previous) => !previous)}
              >
                {includeDetail
                  ? "Hide sensitive details"
                  : "Show sensitive trace details"}
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Raw prompts and tool outputs can contain private source material.
              Known credentials are redacted. Details expire after seven days;
              summarized history remains.
            </p>
            {trace.detailExpired ? (
              <p className="text-muted-foreground text-sm">
                Raw details for this run have expired.
              </p>
            ) : null}
            {trace.truncated ? (
              <p role="status" className="text-sm">
                Showing the first 500 events. Token totals and this trace may be
                incomplete.
              </p>
            ) : null}
            <AutopilotTraceEvents
              events={trace.events}
              includeDetail={includeDetail}
            />
          </section>
        </>
      ) : null}
    </main>
  );
}
