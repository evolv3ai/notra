import { runSiteJob } from "@notra/sites-server/runner";

export async function runSiteJobStep(jobId: string) {
  "use step";
  return await runSiteJob(jobId);
}

// A lost step_started response can consume an SDK attempt before the job runs.
// Job leases and build retry limits are still enforced by runSiteJob.
runSiteJobStep.maxRetries = 3;
