import { isDemoMode } from "@notra/utils/demo-mode";
import { Duration, Effect, Schedule } from "effect";

import {
  bumpAnalyticsVersions,
  advancePurgeGeneration,
} from "../cache/query-cache";
import type {
  PurgeGeoProjectInput,
  PurgeOrganizationInput,
  PurgeSiteInput,
  PurgeSocialAccountInput,
} from "../types/purge";

const ACCOUNT_SCOPED_DATASOURCES = [
  "social_accounts",
  "social_account_stats",
  "social_posts",
  "social_post_stats",
  "social_post_stats_latest",
  "social_account_stats_latest",
  "social_post_sources",
];
// Rollups are MV targets: deleting from geo_traffic_events does not reach them.
const GEO_DATASOURCES = [
  "geo_traffic_events",
  "geo_traffic_daily",
  "geo_traffic_pages_by_host_daily",
];
const WEB_DATASOURCES = [
  "web_page_views",
  "web_page_engagement",
  "web_pages_daily",
  "web_sources_daily",
  "web_audience_daily",
];
const MCP_DATASOURCES = ["mcp_events", "mcp_daily"];

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_POLL_MAX_ATTEMPTS = 60;
const TINYBIRD_READ_TIMEOUT_MS = 10_000;
const TINYBIRD_MUTATION_TIMEOUT_MS = 30_000;

function sanitize(value: string): string {
  return value.replace(/['"\\]/g, "");
}

function tinybirdBaseUrl(): string {
  return (
    process.env.TINYBIRD_BASE_URL ??
    process.env.TINYBIRD_URL ??
    "https://api.tinybird.co"
  );
}

function isRetryableJobPollError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "TimeoutError") ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError"))
  );
}

type TinybirdJobPoll = "done" | "pending";

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * One job status read. Timed-out or aborted reads count as "still pending" so
 * a slow poll costs an attempt instead of failing the purge.
 */
function pollJob(jobId: string): Effect.Effect<TinybirdJobPoll, Error> {
  return Effect.tryPromise({
    try: async (signal): Promise<TinybirdJobPoll> => {
      const response = await fetch(`${tinybirdBaseUrl()}/v0/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${process.env.TINYBIRD_TOKEN}` },
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(TINYBIRD_READ_TIMEOUT_MS),
        ]),
      });
      if (!response.ok) {
        throw new Error(`Tinybird job poll failed (${response.status})`);
      }
      const job: { status?: string; error?: string } = await response.json();
      if (job.status === "error") {
        throw new Error(
          `Tinybird delete job failed: ${job.error ?? "unknown"}`
        );
      }
      return job.status === "done" ? "done" : "pending";
    },
    catch: (cause) => cause,
  }).pipe(
    Effect.catchIf(isRetryableJobPollError, () =>
      Effect.succeed<TinybirdJobPoll>("pending")
    ),
    Effect.mapError(toError)
  );
}

/** Polls the job every second, up to {@link JOB_POLL_MAX_ATTEMPTS} reads. */
function waitForJob(jobId: string): Effect.Effect<void, Error> {
  return pollJob(jobId).pipe(
    Effect.repeat({
      schedule: Schedule.spaced(Duration.millis(JOB_POLL_INTERVAL_MS)),
      times: JOB_POLL_MAX_ATTEMPTS - 1,
      until: (status) => status === "done",
    }),
    Effect.flatMap((status) =>
      status === "done"
        ? Effect.void
        : Effect.fail(new Error("Tinybird delete job timed out"))
    )
  );
}

async function submitDelete(
  datasource: string,
  condition: string
): Promise<string | undefined> {
  const response = await fetch(
    `${tinybirdBaseUrl()}/v0/datasources/${datasource}/delete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TINYBIRD_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ delete_condition: condition }),
      signal: AbortSignal.timeout(TINYBIRD_MUTATION_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Tinybird delete on ${datasource} failed (${response.status}): ${detail}`
    );
  }
  const payload: { job_id?: string; id?: string } = await response.json();
  return payload.job_id ?? payload.id;
}

function deleteFromDatasource(
  datasource: string,
  condition: string
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: () => submitDelete(datasource, condition),
    catch: toError,
  }).pipe(Effect.flatMap((jobId) => (jobId ? waitForJob(jobId) : Effect.void)));
}

/**
 * Deletes matching rows from every datasource. `waitForJobs` also waits for
 * each Tinybird job so a failed job fails the purge and its caller can retry.
 */
async function submitDeletes(
  datasources: string[],
  condition: string,
  waitForJobs: boolean
): Promise<void> {
  if (!process.env.TINYBIRD_TOKEN) {
    if (process.env.NODE_ENV === "production" && !isDemoMode()) {
      throw new Error("TINYBIRD_TOKEN is not set, deleted analytics remain");
    }
    return;
  }
  const results = await Promise.allSettled(
    datasources.map((datasource) =>
      waitForJobs
        ? Effect.runPromise(deleteFromDatasource(datasource, condition))
        : submitDelete(datasource, condition)
    )
  );
  const errors = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Tinybird delete failed on ${errors.length} of ${datasources.length} datasources`
    );
  }
}

export function purgeSocialAccountData(
  input: PurgeSocialAccountInput
): Promise<void> {
  if (!process.env.TINYBIRD_TOKEN) {
    return Promise.resolve();
  }
  const condition = `organization_id = '${sanitize(input.organizationId)}' AND provider = '${sanitize(input.provider)}' AND provider_account_id = '${sanitize(input.providerAccountId)}'`;
  const program = Effect.gen(function* () {
    yield* Effect.forEach(
      ACCOUNT_SCOPED_DATASOURCES,
      (datasource) => deleteFromDatasource(datasource, condition),
      { discard: true }
    );
    yield* Effect.tryPromise(() =>
      bumpAnalyticsVersions("social", [input.organizationId])
    );
  });
  return Effect.runPromise(program);
}

export function purgeGeoProjectData(
  input: PurgeGeoProjectInput
): Promise<void> {
  if (!process.env.TINYBIRD_TOKEN) {
    return Promise.resolve();
  }
  const condition = `organization_id = '${sanitize(input.organizationId)}' AND project_id = '${sanitize(input.projectId)}'`;
  const program = Effect.gen(function* () {
    yield* Effect.forEach(
      GEO_DATASOURCES,
      (datasource) => deleteFromDatasource(datasource, condition),
      { discard: true }
    );
    yield* Effect.tryPromise(() =>
      advancePurgeGeneration("geo", input.organizationId)
    );
  });
  return Effect.runPromise(program);
}

/**
 * Removes every GEO and web analytics row of a deleted project. The immediate
 * purge only submits the delete jobs: nothing reads a deleted project, so the
 * request does not wait for Tinybird. The delayed purge waits for them.
 */
export function purgeDeletedProjectAnalytics(
  input: PurgeGeoProjectInput,
  waitForJobs = false
): Promise<void> {
  return submitDeletes(
    [...GEO_DATASOURCES, ...WEB_DATASOURCES, ...MCP_DATASOURCES],
    `organization_id = '${sanitize(input.organizationId)}' AND project_id = '${sanitize(input.projectId)}'`,
    waitForJobs
  );
}

export function purgeDeletedOrganizationAnalytics(
  input: PurgeOrganizationInput,
  waitForJobs = false
): Promise<void> {
  return submitDeletes(
    [
      ...ACCOUNT_SCOPED_DATASOURCES,
      ...GEO_DATASOURCES,
      ...WEB_DATASOURCES,
      ...MCP_DATASOURCES,
    ],
    `organization_id = '${sanitize(input.organizationId)}'`,
    waitForJobs
  );
}

export function purgeDeletedSiteAnalytics(
  input: PurgeSiteInput,
  waitForJobs = false
): Promise<void> {
  return submitDeletes(
    [...GEO_DATASOURCES, ...WEB_DATASOURCES],
    `organization_id = '${sanitize(input.organizationId)}' AND site_id = '${sanitize(input.siteId)}'`,
    waitForJobs
  );
}
