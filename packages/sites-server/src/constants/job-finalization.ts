import { siteDeployments, siteJobs } from "@notra/db/schema";
import { inArray, sql } from "drizzle-orm";

export const BUILD_FINALIZATION_STATUSES = [
  "ready",
  "skipped",
  "expired",
] as const;

export const BUILD_FINALIZATION_JOB = sql`(${siteJobs.kind} = 'build' and exists (
  select 1 from ${siteDeployments}
  where ${siteDeployments.id} = ${siteJobs.deploymentId}
  and ${siteDeployments.siteId} = ${siteJobs.siteId}
  and ${inArray(siteDeployments.status, BUILD_FINALIZATION_STATUSES)}
))`;
