"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/button";
import {
  AUTOPILOT_ADMIN_PAGE_SIZE,
  AUTOPILOT_ADMIN_POLL_MS,
} from "@/constants/autopilot";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  AutopilotPageCursor,
  AutopilotPageProps,
  AutopilotStatusFilter,
} from "@/types/autopilot";
import {
  autopilotDuration,
  autopilotTimestamp,
  hasMissingAutopilotHeartbeat,
} from "@/utils/autopilot";

export function AutopilotRunsClient({ slug }: AutopilotPageProps) {
  const [organization, setOrganization] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [status, setStatus] = useState<AutopilotStatusFilter>("all");
  const [cursors, setCursors] = useState<AutopilotPageCursor[]>([]);
  const query = useQuery({
    ...consoleOrpc.autopilot.runs.queryOptions({
      input: {
        organizationId: workspace || undefined,
        status: status === "all" ? undefined : status,
        limit: AUTOPILOT_ADMIN_PAGE_SIZE,
        ...cursors.at(-1),
      },
    }),
    refetchInterval: AUTOPILOT_ADMIN_POLL_MS,
  });
  const runs = query.data?.runs ?? [];
  const missing = runs.filter((run) => hasMissingAutopilotHeartbeat(run));
  const last = runs.at(-1);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Autopilot</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Runs and decisions across workspaces. Notra admins only.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          Refresh
        </Button>
      </header>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setWorkspace(organization.trim());
          setCursors([]);
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="autopilot-workspace">Workspace ID</Label>
          <Input
            id="autopilot-workspace"
            placeholder="All workspaces"
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="autopilot-status">Status</Label>
          <select
            id="autopilot-status"
            className="bg-background h-9 rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AutopilotStatusFilter);
              setCursors([]);
            }}
          >
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <Button type="submit" variant="outline">
          Apply workspace filter
        </Button>
      </form>
      {missing.length > 0 ? (
        <div role="status" className="rounded-lg border p-4 text-sm">
          <strong>
            {missing.length} runs have not reported a heartbeat for over five
            minutes.
          </strong>{" "}
          Open a run to inspect its last activity before retrying.
        </div>
      ) : null}
      <p role="status" className="text-muted-foreground text-sm">
        {query.isPending
          ? "Loading runs…"
          : `${runs.length} runs on this page · ${runs.filter((run) => run.status === "running").length} running · ${runs.filter((run) => run.status === "failed").length} failed`}
      </p>
      {query.isError ? (
        <div role="alert" className="rounded-lg border p-4 text-sm">
          Could not load Autopilot runs. Check the dashboard connection and try
          Refresh.
        </div>
      ) : null}
      {query.data ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace / run</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Drafts / failed findings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link
                      className="font-medium underline-offset-4 hover:underline"
                      href={`/${slug}/autopilot/${encodeURIComponent(run.id)}`}
                    >
                      {run.organizationSlug}
                      <span className="text-muted-foreground block font-mono text-xs">
                        {run.id}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>{run.trigger}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        run.status === "failed" ? "destructive" : "secondary"
                      }
                    >
                      {run.status}
                    </Badge>
                    {hasMissingAutopilotHeartbeat(run) ? (
                      <span className="mt-1 block text-xs">
                        Heartbeat missing
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{autopilotDuration(run)}</TableCell>
                  <TableCell>
                    <time dateTime={run.startedAt}>
                      {autopilotTimestamp(run.startedAt)}
                    </time>
                  </TableCell>
                  <TableCell>
                    {run.summary?.proposed ?? 0} / {run.summary?.failed ?? 0}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    No runs match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          disabled={cursors.length === 0 || query.isFetching}
          onClick={() => setCursors((previous) => previous.slice(0, -1))}
        >
          Newer runs
        </Button>
        <Button
          variant="outline"
          disabled={runs.length < AUTOPILOT_ADMIN_PAGE_SIZE || query.isFetching}
          onClick={() => {
            if (last) {
              setCursors((previous) => [
                ...previous,
                { before: last.startedAt, beforeId: last.id },
              ]);
            }
          }}
        >
          Older runs
        </Button>
      </div>
    </main>
  );
}
