import { readFileSync } from "node:fs";

// The deploy job prepares while the gates run; nothing goes live until every
// gate job in this run attempt has succeeded.
// Jobs marked continue-on-error report failures without blocking the release,
// exactly as they never failed the sites-e2e workflow call.
export function sitesE2EJobs(
  workflow = readFileSync(".github/workflows/sites-e2e.yml", "utf8")
) {
  const blocks = (workflow.split(/^jobs:\s*$/m)[1] ?? "")
    .split(/^ {2}(?=[\w-]+:\s*$)/m)
    .slice(1);
  const optional = new Set();
  for (const block of blocks) {
    const name = /^ {4}name:\s*(.+?)\s*$/m.exec(block)?.[1];
    if (name && /^ {4}continue-on-error:\s*true\s*$/m.test(block)) {
      optional.add(`sites-e2e / ${name.replace(/^(["'])(.*)\1$/, "$2")}`);
    }
  }
  return { count: blocks.length, optional };
}

export async function waitForReleaseGates({
  env,
  fetchImpl = fetch,
  sleep,
  report,
  sitesE2E = env.SITES_E2E_GATE === "false"
    ? { count: 0, optional: new Set() }
    : sitesE2EJobs(),
  timeoutMs = 45 * 60_000,
  pollMs = 5000,
}) {
  if (!env.GITHUB_RUN_ID) {
    throw new Error("GITHUB_RUN_ID is required to wait for the release gates");
  }
  // filter=latest keeps gates that passed in an earlier attempt when only
  // failed jobs are re-run.
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/jobs?filter=latest&per_page=100`;
  // A skipped reusable workflow shows up as one job named plainly sites-e2e.
  const isE2E = (job) => job.name.startsWith("sites-e2e / ");
  const isGate = (job) =>
    job.name === "agents" ||
    (sitesE2E.count > 0 && (job.name === "sites-e2e" || isE2E(job)));
  const deadline = Date.now() + timeoutMs;
  let waiting = "";
  for (let attempt = 0; attempt < 2000 && Date.now() < deadline; attempt += 1) {
    let jobs;
    try {
      const response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      jobs = (await response.json()).jobs.filter(isGate);
    } catch (error) {
      await report(`release gates: ${error.message}; retrying`);
      await sleep(pollMs);
      continue;
    }
    const failed = jobs.find(
      (job) =>
        job.status === "completed" &&
        job.conclusion !== "success" &&
        !sitesE2E.optional.has(job.name)
    );
    if (failed) {
      throw new Error(
        `release gates: ${failed.name} ended ${failed.conclusion}; nothing went live`
      );
    }
    const e2e = jobs.filter(isE2E);
    const complete =
      jobs.some((job) => job.name === "agents") &&
      e2e.length === sitesE2E.count &&
      jobs.every((job) => job.status === "completed");
    if (complete) {
      for (const job of jobs.filter((gate) => gate.conclusion !== "success")) {
        await report(
          `release gates: ${job.name} ended ${job.conclusion}; it does not block releases`
        );
      }
      await report(`release gates: ${jobs.length} jobs finished`);
      return;
    }
    const pending = jobs
      .filter((job) => job.status !== "completed")
      .map((job) => job.name)
      .join(", ");
    if (pending !== waiting) {
      waiting = pending;
      await report(`release gates: waiting for ${pending || "gate jobs"}`);
    }
    await sleep(pollMs);
  }
  throw new Error("release gates: did not finish in time; nothing went live");
}
