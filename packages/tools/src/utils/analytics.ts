import { isTinybirdConfigured } from "@notra/analytics/tinybird/client";
import { db } from "@notra/db/drizzle";
import { brandSettings, projects } from "@notra/db/schema";
import { asc, eq } from "drizzle-orm";

import {
  ANALYTICS_NOT_CONFIGURED_MESSAGE,
  ANALYTICS_QUERY_FAILED_MESSAGE,
  DAY_MS,
} from "../constants/analytics";
import type {
  AnalyticsProject,
  AnalyticsRange,
  AnalyticsRangeInput,
} from "../types/analytics";

export async function runSocialAnalyticsQuery<Row, Output>(
  query: () => Promise<{ data: Row[] } | null>,
  toOutput: (rows: Row[]) => Output
): Promise<Output | string> {
  if (!isTinybirdConfigured()) {
    return ANALYTICS_NOT_CONFIGURED_MESSAGE;
  }

  try {
    const result = await query();
    if (!result) {
      return ANALYTICS_NOT_CONFIGURED_MESSAGE;
    }
    return toOutput(result.data);
  } catch (error) {
    return `${ANALYTICS_QUERY_FAILED_MESSAGE} ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDay(day: string): number | null {
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isNaN(ms) || toIsoDay(new Date(ms)) !== day ? null : ms;
}

/**
 * Turns a tool's days/from/to input into an explicit inclusive UTC range, so
 * "7 days" covers exactly seven daily buckets ending today.
 */
export function resolveAnalyticsRange(
  input: AnalyticsRangeInput,
  now = new Date()
): AnalyticsRange | string {
  const today = toIsoDay(now);
  if (!input.from) {
    const todayMs = Date.parse(`${today}T00:00:00.000Z`);
    return {
      from: toIsoDay(new Date(todayMs - (input.days - 1) * DAY_MS)),
      to: today,
      days: input.days,
      timezone: "UTC",
    };
  }

  const to = input.to ?? today;
  const fromMs = parseIsoDay(input.from);
  const toMs = parseIsoDay(to);
  if (fromMs === null || toMs === null) {
    return "Invalid date. Use a real calendar day in YYYY-MM-DD format.";
  }
  if (fromMs > toMs) {
    return "from must be on or before to.";
  }
  const days = Math.round((toMs - fromMs) / DAY_MS) + 1;
  if (days > 366) {
    return "Use a range of 366 days or fewer.";
  }
  return { from: input.from, to, days, timezone: "UTC" };
}

/** Bare lowercase domain for the Tinybird hosts filter, which also matches subdomains. */
export function normalizeHostFilter(host: string | undefined): string {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/:?#].*$/, "")
    .replace(/^www\./, "");
}

/** Projects oldest first; the oldest is the default scope everywhere in Notra. */
export async function listOrganizationProjects(organizationId: string) {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      websiteUrl: brandSettings.websiteUrl,
      isSample: projects.isSample,
    })
    .from(projects)
    .leftJoin(brandSettings, eq(projects.brandSettingsId, brandSettings.id))
    .where(eq(projects.organizationId, organizationId))
    .orderBy(asc(projects.createdAt), asc(projects.id));
  return rows.map((row, index) => ({ ...row, isDefault: index === 0 }));
}

export async function resolveAnalyticsProject(
  organizationId: string,
  projectId: string | undefined
): Promise<AnalyticsProject | null> {
  const rows = await listOrganizationProjects(organizationId);
  const row = projectId ? rows.find((r) => r.id === projectId) : rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        isDefault: row.isDefault,
        otherProjects: rows.length - 1,
      }
    : null;
}
