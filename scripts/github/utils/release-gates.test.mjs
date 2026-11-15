import assert from "node:assert/strict";
import { test } from "node:test";

import { sitesE2EJobs, waitForReleaseGates } from "./release-gates.mjs";

const env = {
  GH_TOKEN: "test",
  GITHUB_REPOSITORY: "usenotra/notra",
  GITHUB_RUN_ID: "41",
};
const e2e = (status, conclusion = null) =>
  ["Lifecycle", "Browser", "Vendor"].map((name) => ({
    name: `sites-e2e / ${name}`,
    status,
    conclusion,
  }));
const job = (name, status, conclusion = null) => ({ name, status, conclusion });
const done = (name) => job(name, "completed", "success");

function gates(polls, overrides = {}) {
  const urls = [];
  const messages = [];
  let index = 0;
  const run = () =>
    waitForReleaseGates({
      env,
      sitesE2E: { count: 3, optional: new Set(["sites-e2e / Vendor"]) },
      sleep: async () => {},
      report: async (message) => {
        messages.push(message);
      },
      fetchImpl: async (url) => {
        urls.push(url);
        const poll = polls[Math.min(index, polls.length - 1)];
        index += 1;
        if (poll instanceof Error) {
          throw poll;
        }
        return { ok: true, status: 200, json: async () => ({ jobs: poll }) };
      },
      ...overrides,
    });
  return { run, urls, messages, polls: () => index };
}

test("reads the Sites E2E jobs and which of them do not block releases", () => {
  assert.deepEqual(sitesE2EJobs(), {
    count: 3,
    optional: new Set(["sites-e2e / Vendor analytics scripts (live)"]),
  });
  assert.deepEqual(
    sitesE2EJobs(
      'on: push\njobs:\n  a:\n    name: A\n    steps: []\n  b-c:\n    name: "B C"\n    continue-on-error: true\n    steps:\n      - continue-on-error: true\n'
    ),
    { count: 2, optional: new Set(["sites-e2e / B C"]) }
  );
});

test("a failed continue-on-error job is waited for but does not block", async () => {
  const { run, messages } = gates([
    [
      done("sites-e2e / Lifecycle"),
      done("sites-e2e / Browser"),
      job("sites-e2e / Vendor", "in_progress"),
      done("agents"),
    ],
    [
      done("sites-e2e / Lifecycle"),
      done("sites-e2e / Browser"),
      job("sites-e2e / Vendor", "completed", "failure"),
      done("agents"),
    ],
  ]);
  await run();
  assert.ok(
    messages.includes(
      "release gates: sites-e2e / Vendor ended failure; it does not block releases"
    )
  );
});

test("waits until the latest run of every gate job succeeded", async () => {
  const { run, urls, polls } = gates([
    [
      ...e2e("in_progress"),
      job("agents", "in_progress"),
      job("deploy", "in_progress"),
    ],
    [...e2e("completed", "success"), job("agents", "in_progress")],
    [
      ...e2e("completed", "success"),
      done("agents"),
      job("deploy", "in_progress"),
    ],
  ]);
  await run();
  assert.equal(polls(), 3);
  assert.equal(
    urls[0],
    "https://api.github.com/repos/usenotra/notra/actions/runs/41/jobs?filter=latest&per_page=100"
  );
});

for (const conclusion of ["failure", "cancelled", "skipped", "timed_out"]) {
  test(`a gate job that ended ${conclusion} fails closed at once`, async () => {
    const { run, polls } = gates([
      [
        job("sites-e2e / Browser", "completed", conclusion),
        job("sites-e2e / Lifecycle", "in_progress"),
        job("agents", "in_progress"),
      ],
    ]);
    await assert.rejects(
      run(),
      new RegExp(`sites-e2e / Browser ended ${conclusion}; nothing went live`)
    );
    assert.equal(polls(), 1);
  });
}

test("a skipped Sites E2E workflow fails closed unless the skip was requested", async () => {
  const skipped = [job("sites-e2e", "completed", "skipped"), done("agents")];
  await assert.rejects(gates([skipped]).run(), /sites-e2e ended skipped/);
  await gates([skipped], { sitesE2E: { count: 0, optional: new Set() } }).run();
});

test("missing gate jobs are waited for, never treated as passed", async () => {
  const { run } = gates(
    [[job("sites-e2e / Lifecycle", "completed", "success"), done("agents")]],
    { timeoutMs: 60_000 }
  );
  await assert.rejects(run(), /did not finish in time; nothing went live/);
});

test("an emergency release without Sites E2E still requires the agents", async () => {
  const { run } = gates([[done("agents")]], {
    sitesE2E: { count: 0, optional: new Set() },
  });
  await run();
  const { run: withoutAgents } = gates([[]], {
    sitesE2E: { count: 0, optional: new Set() },
    timeoutMs: 60_000,
  });
  await assert.rejects(withoutAgents(), /did not finish in time/);
});

test("GitHub API errors are retried", async () => {
  const { run, messages } = gates([
    new TypeError("fetch failed"),
    [...e2e("completed", "success"), done("agents")],
  ]);
  await run();
  assert.match(messages[0], /fetch failed; retrying/);
});

test("the run id is required", async () => {
  await assert.rejects(
    waitForReleaseGates({
      env: { GH_TOKEN: "x" },
      sleep: async () => {},
      report: async () => {},
    }),
    /GITHUB_RUN_ID is required/
  );
});
