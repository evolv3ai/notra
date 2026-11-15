import { appendFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const releaseWorkflows = ["code-quality.yml", "knip.yml"];
const fallbackCommitLimit = 30;

// Thrown when release CI is red, cancelled or still missing; selection may
// fall back to an older green commit. Other errors stop the release.
export class ReleaseCINotPassedError extends Error {}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GH_TOKEN}`,
    Accept: "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Cache-Control": "no-cache",
  };
}

function assertReleaseEnv(env) {
  if (!env.GH_TOKEN || !env.GITHUB_SHA) {
    throw new Error("GH_TOKEN and GITHUB_SHA are required");
  }
  if (
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_REPOSITORY !== "usenotra/notra"
  ) {
    throw new Error("Production releases must run from usenotra/notra main");
  }
}

async function latestPushRun({ env, fetchImpl, workflow, sha, timeout }) {
  const url = new URL(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs`
  );
  url.search = new URLSearchParams({
    head_sha: sha,
    branch: "main",
    event: "push",
    per_page: "1",
  }).toString();
  let response;
  try {
    response = await fetchImpl(url, {
      headers: githubHeaders(env),
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    return { pending: `${workflow}: GitHub request failed` };
  }
  if (!response.ok) {
    if (response.status !== 429 && response.status < 500) {
      throw new Error(
        `${workflow}: GitHub HTTP ${response.status}; no builds started`
      );
    }
    return { pending: `${workflow}: GitHub HTTP ${response.status}` };
  }
  const result = await response.json();
  if (!Array.isArray(result.workflow_runs)) {
    throw new Error(`${workflow}: invalid GitHub response; no builds started`);
  }
  const run = result.workflow_runs[0];
  const state = run
    ? `${workflow}: run ${run.id ?? "unknown"}, sha ${run.head_sha}, ${run.status}/${run.conclusion ?? "pending"}`
    : `${workflow}: no push run found for ${sha}`;
  return { run, state };
}

export async function requireReleaseCI({
  env = process.env,
  sha = env.GITHUB_SHA,
  fetchImpl = fetch,
  sleep = delay,
  report = console.log,
} = {}) {
  assertReleaseEnv(env);

  const deadline = Date.now() + 10 * 60_000;
  let pending = [];
  let checks = 0;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    if (Date.now() >= deadline) {
      break;
    }
    checks = attempt;
    pending = [];
    for (const workflow of releaseWorkflows) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        pending.push(`${workflow}: CI polling deadline reached`);
        continue;
      }
      const {
        run,
        state,
        pending: requestPending,
      } = await latestPushRun({
        env,
        fetchImpl,
        workflow,
        sha,
        timeout: Math.min(30_000, remaining),
      });
      if (requestPending) {
        pending.push(requestPending);
        continue;
      }
      await report(`CI check ${attempt}/20: ${state}`);
      if (run?.head_sha !== sha || run.status !== "completed") {
        pending.push(state);
      } else if (run.conclusion !== "success") {
        throw new ReleaseCINotPassedError(
          `${state}; has not passed; no builds started`
        );
      }
    }
    if (pending.length === 0) {
      return;
    }
    await report(`Waiting for release CI: ${pending.join("; ")}`);
    if (attempt < 20) {
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        await sleep(Math.min(30_000, remaining));
      }
    }
  }
  throw new ReleaseCINotPassedError(
    `Release CI has not passed for ${sha} after ${checks} checks (10-minute limit): ${pending.join("; ")}; no builds started`
  );
}

async function isGreen({ env, fetchImpl, sha }) {
  for (const workflow of releaseWorkflows) {
    const { run } = await latestPushRun({
      env,
      fetchImpl,
      workflow,
      sha,
      timeout: 30_000,
    });
    if (
      run?.head_sha !== sha ||
      run.status !== "completed" ||
      run.conclusion !== "success"
    ) {
      return false;
    }
  }
  return true;
}

// Releases main's head when its CI passes. A red or stuck head (often a flaky
// test) falls back to the newest earlier main commit whose release CI passed,
// so one bad merge does not cancel the whole scheduled release.
export async function selectReleaseCommit({
  env = process.env,
  fetchImpl = fetch,
  sleep = delay,
  report = console.log,
} = {}) {
  const head = env.GITHUB_SHA;
  try {
    await requireReleaseCI({ env, sha: head, fetchImpl, sleep, report });
    return head;
  } catch (error) {
    if (!(error instanceof ReleaseCINotPassedError)) {
      throw error;
    }
    await report(`Head ${head} is not releasable: ${error.message}`);
    const url = new URL(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/commits`
    );
    url.search = new URLSearchParams({
      sha: head,
      per_page: String(fallbackCommitLimit),
    }).toString();
    const response = await fetchImpl(url, {
      headers: githubHeaders(env),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `commits: GitHub HTTP ${response.status}; no builds started`
      );
    }
    const commits = await response.json();
    for (const { sha } of commits.slice(1)) {
      if (await isGreen({ env, fetchImpl, sha })) {
        await report(`Falling back to newest green main commit ${sha}`);
        return sha;
      }
    }
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const sha = await selectReleaseCommit();
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `sha=${sha}\n`);
  }
}
