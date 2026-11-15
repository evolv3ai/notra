import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRuns,
  organizations,
} from "@notra/db/schema";
import type { AutopilotRunEventData } from "@notra/db/types/autopilot";
import { and, desc, eq, lt, or } from "drizzle-orm";

import {
  AUTOPILOT_ADMIN_RUNS_DEFAULT_LIMIT,
  AUTOPILOT_TRACE_DETAIL_RETENTION_MS,
} from "@/constants/autopilot";
import { AUTOPILOT_ADMIN_TRACE_EVENT_LIMIT } from "@/constants/autopilot-observability";
import { listRunTrace } from "@/lib/autopilot/log";
import type { AutopilotAdminRunFilters } from "@/types/autopilot-runtime";
import {
  clipAutopilotTraceDetail,
  redactAutopilotTraceDetail,
} from "@/utils/autopilot-log";

/** Recent runs across workspaces, newest first, for the admin console. */
export async function listAdminRuns(params: AutopilotAdminRunFilters) {
  const runs = await db
    .select({
      id: autopilotRuns.id,
      organizationId: autopilotRuns.organizationId,
      organizationSlug: organizations.slug,
      trigger: autopilotRuns.trigger,
      status: autopilotRuns.status,
      summary: autopilotRuns.summary,
      errorMessage: autopilotRuns.errorMessage,
      startedAt: autopilotRuns.startedAt,
      finishedAt: autopilotRuns.finishedAt,
      heartbeatAt: autopilotRuns.heartbeatAt,
    })
    .from(autopilotRuns)
    .innerJoin(
      organizations,
      eq(organizations.id, autopilotRuns.organizationId)
    )
    .where(
      and(
        params.organizationId
          ? eq(autopilotRuns.organizationId, params.organizationId)
          : undefined,
        params.before
          ? or(
              lt(autopilotRuns.startedAt, new Date(params.before)),
              params.beforeId
                ? and(
                    eq(autopilotRuns.startedAt, new Date(params.before)),
                    lt(autopilotRuns.id, params.beforeId)
                  )
                : undefined
            )
          : undefined,
        params.status ? eq(autopilotRuns.status, params.status) : undefined
      )
    )
    .orderBy(desc(autopilotRuns.startedAt), desc(autopilotRuns.id))
    .limit(params.limit ?? AUTOPILOT_ADMIN_RUNS_DEFAULT_LIMIT);
  return runs.map((run) => ({
    ...run,
    errorMessage: redactAutopilotTraceDetail(run.errorMessage) as string | null,
  }));
}

/** One run with every event, including admin-only ones and their details. */
export async function loadAdminTrace(runId: string, includeDetail = false) {
  const [run, events, findings] = await Promise.all([
    db.query.autopilotRuns.findFirst({ where: eq(autopilotRuns.id, runId) }),
    listRunTrace(runId),
    db.query.autopilotFindings.findMany({
      columns: {
        id: true,
        title: true,
        summary: true,
        status: true,
        pullRequestUrl: true,
        repository: true,
        errorMessage: true,
      },
      where: eq(autopilotFindings.runId, runId),
    }),
  ]);
  if (!run) {
    return null;
  }
  const organization = await db.query.organizations.findFirst({
    columns: { slug: true },
    where: eq(organizations.id, run.organizationId),
  });
  const cutoff = Date.now() - AUTOPILOT_TRACE_DETAIL_RETENTION_MS;
  return {
    run: {
      ...run,
      errorMessage: redactAutopilotTraceDetail(run.errorMessage) as
        | string
        | null,
      organizationSlug: organization?.slug ?? run.organizationId,
    },
    events: events.slice(0, AUTOPILOT_ADMIN_TRACE_EVENT_LIMIT).map((event) => ({
      ...event,
      message: redactAutopilotTraceDetail(event.message) as string,
      data: redactAutopilotTraceDetail(
        event.data
      ) as AutopilotRunEventData | null,
      detail:
        includeDetail && event.createdAt.getTime() >= cutoff
          ? clipAutopilotTraceDetail(redactAutopilotTraceDetail(event.detail))
          : null,
    })),
    findings: findings.map((finding) => ({
      ...finding,
      title: redactAutopilotTraceDetail(finding.title) as string,
      summary: redactAutopilotTraceDetail(finding.summary) as string,
      errorMessage: redactAutopilotTraceDetail(finding.errorMessage) as
        | string
        | null,
    })),
    detailExpired:
      events.length > 0
        ? events.every((event) => event.createdAt.getTime() < cutoff)
        : run.startedAt.getTime() < cutoff,
    truncated: events.length > AUTOPILOT_ADMIN_TRACE_EVENT_LIMIT,
  };
}

export function listAdminFindings(organizationId: string) {
  return db.query.autopilotFindings.findMany({
    where: eq(autopilotFindings.organizationId, organizationId),
    orderBy: [desc(autopilotFindings.updatedAt)],
  });
}
