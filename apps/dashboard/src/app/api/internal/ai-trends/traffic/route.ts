import { logError } from "@notra/ai/utils/server-log";
import {
  isTinybirdConfigured,
  queryGeoTrafficTrendsDaily,
  queryGeoTrafficTrendsProjects,
} from "@notra/analytics/tinybird/client";
import { db } from "@notra/db/drizzle";
import { demoSandboxes, projects } from "@notra/db/schema";
import { aiTrendsTrafficRequestSchema } from "@notra/schemas/api/ai-trends-traffic";
import { and, eq, inArray, notInArray } from "drizzle-orm";

import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * Projects whose traffic counts towards the trends: they still exist, aren't
 * sample projects (those ingest generated crawler visits) and don't belong
 * to a demo sandbox.
 */
async function realProjectIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        inArray(projects.id, ids),
        eq(projects.isSample, false),
        notInArray(
          projects.organizationId,
          db
            .select({ organizationId: demoSandboxes.organizationId })
            .from(demoSandboxes)
        )
      )
    );
  return new Set(rows.map((row) => row.id));
}

/**
 * Cross-organization AI traffic for the Notra admin console's AI Search
 * Trends page. Tinybird credentials live here, so the console asks this route
 * instead of reading Tinybird itself.
 */
export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = aiTrendsTrafficRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!isTinybirdConfigured()) {
    return Response.json({ configured: false, daily: [], projects: [] });
  }

  const { from, baselineFrom, recentFrom, toExclusive } = parsed.data;
  try {
    const projectRows =
      (
        await queryGeoTrafficTrendsProjects({
          date_from: from,
          date_to: toExclusive,
          baseline_from: baselineFrom,
          recent_from: recentFrom,
        })
      )?.data ?? [];
    const projectIds = [...new Set(projectRows.map((row) => row.project_id))];
    const real = await realProjectIds(projectIds);
    const excluded = projectIds.filter((id) => !real.has(id));
    const daily =
      (
        await queryGeoTrafficTrendsDaily({
          date_from: from,
          date_to: toExclusive,
          excluded_project_ids: excluded.join(","),
        })
      )?.data ?? [];
    return Response.json({
      configured: true,
      daily,
      projects: projectRows.filter((row) => real.has(row.project_id)),
    });
  } catch (error) {
    logError("AI trends traffic query failed", error);
    return Response.json({ error: "AI traffic query failed" }, { status: 502 });
  }
}
