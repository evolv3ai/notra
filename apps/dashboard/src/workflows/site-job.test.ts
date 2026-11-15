import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { SiteJobOutcome } from "@notra/sites-server/types/jobs";

if (process.env.NOTRA_SITE_JOB_WORKFLOW_TEST !== "1") {
  test("site job workflow retries preserve the database-owned job lifecycle", () => {
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_SITE_JOB_WORKFLOW_TEST: "1" },
        timeout: 15_000,
      }
    );
    expect(result.status, result.stderr.toString()).toBe(0);
  }, 20_000);
} else {
  const runSiteJob = mock(async (_jobId: string): Promise<SiteJobOutcome> => ({
    status: "done",
    outcome: "live",
  }));
  mock.module("@notra/sites-server/runner", () => ({ runSiteJob }));

  const { siteJobWorkflow } = await import("./site-job");
  const { runSiteJobStep } = await import("./steps/site-job-step");

  beforeEach(() => {
    runSiteJob.mockClear();
  });

  test("allows bounded SDK retries when a start event was persisted but its response was lost", () => {
    expect(runSiteJobStep.maxRetries).toBe(3);
  });

  test("propagates infrastructure failures so the SDK can retry the same job", async () => {
    const error = new Error("database unavailable while claiming job");
    runSiteJob.mockRejectedValueOnce(error);
    await expect(siteJobWorkflow("job-test")).rejects.toBe(error);
    expect(runSiteJob).toHaveBeenCalledTimes(1);
    expect(runSiteJob).toHaveBeenCalledWith("job-test");

    runSiteJob.mockResolvedValueOnce({ status: "done", outcome: "live" });
    await expect(siteJobWorkflow("job-test")).resolves.toEqual({
      status: "done",
      outcome: "live",
    });
    expect(runSiteJob).toHaveBeenLastCalledWith("job-test");
  });

  test.each(["retrying", "failed", "skipped"] as const)(
    "returns a %s job outcome without triggering an SDK retry",
    async (status) => {
      runSiteJob.mockResolvedValueOnce({ status });
      await expect(siteJobWorkflow("job-test")).resolves.toEqual({ status });
      expect(runSiteJob).toHaveBeenCalledTimes(1);
    }
  );
}
