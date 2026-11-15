import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  autopilotFindings,
  autopilotRunEvents,
  autopilotRuns,
  autopilotSettings,
  organizations,
} from "@notra/db/schema";
import { autopilotAdminTraceResponseSchema } from "@notra/schemas/api/autopilot-admin";
import { and, eq } from "drizzle-orm";

import { createAutopilotSandbox } from "./utils/autopilot-sandbox";

if (process.env.NOTRA_AUTOPILOT_SANDBOX_TEST !== "1") {
  test("Autopilot lifecycle and observability on migrated sandbox PostgreSQL", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_AUTOPILOT_SANDBOX_TEST: "1",
          DATABASE_URL: "",
        },
        timeout: 90_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 95_000);
} else {
  const sandbox = await createAutopilotSandbox();
  const db = sandbox.db;
  const startup = { finishBeforeError: false, flag: true };
  mock.module("@/lib/workflows/start", () => ({
    startWorkflowGraphRun: async (payload: {
      input: { autopilotRunId: string };
    }) => {
      if (startup.finishBeforeError) {
        await db
          .update(autopilotRuns)
          .set({ status: "completed" })
          .where(eq(autopilotRuns.id, payload.input.autopilotRunId));
        throw new Error("Lost the launch response");
      }
      return { runId: "runtime-run" };
    },
  }));
  mock.module("@notra/db/drizzle", () => ({ db }));
  mock.module("@/lib/autopilot/flag", () => ({
    isAutopilotEnabledForOrganization: async () => startup.flag,
  }));
  const emptyJob = async () => ({ findingIds: [], insights: [] });
  const notRun = async () => {
    throw new Error("Not run in this sandbox");
  };
  mock.module("@/lib/autopilot/blog", () => ({
    runCommitsJob: emptyJob,
    runKeywordsJob: emptyJob,
    runCompetitorsJob: emptyJob,
    draftFollowsRules: notRun,
    failDraft: notRun,
    openBlogDraftPullRequest: notRun,
    renderBlogDraftHeroImage: notRun,
    writeBlogDraft: notRun,
  }));
  mock.module("@/lib/autopilot/readiness", () => ({
    checkReadiness: async () => ({ ready: false, reason: "Not run here" }),
    claimReadinessFix: notRun,
    writeReadinessFix: notRun,
    openReadinessPullRequest: notRun,
  }));
  mock.module("@/lib/autopilot/prompts", () => ({ runPromptsJob: emptyJob }));
  // Planning is covered by autopilot-flow; here the jobs observe nothing.
  mock.module("@/lib/autopilot/planner", () => ({
    decideAutopilotPlan: async () => ({ outcome: "skip", memory: null }),
    rememberAutopilotPlan: async () => false,
  }));
  mock.module("@notra/ai/utils/github-mention-auth", () => ({
    resolveGitHubMentionAuth: async () => null,
  }));
  mock.module("@/lib/autopilot/github", () => ({
    AutopilotRepositoryAccessError: class extends Error {},
    getRepositoryOctokit: async () => {
      throw new Error("Network is forbidden in the sandbox");
    },
  }));
  mock.module("@/lib/integrations/github/content-pull-request", () => ({
    isMergeMethodNotAllowed: () => false,
    getContentPullRequestState: async () => {
      throw new Error("Network is forbidden in the sandbox");
    },
    markContentPullRequestReady: async () => undefined,
    mergeContentPullRequest: async () => undefined,
  }));
  const {
    claimFinding,
    markFindingProposed,
    dismissFinding,
    recoverStaleFindings,
    markFindingFailed,
    listSettledFingerprints,
    reserveDraftSlot,
    countOpenPullRequests,
  } = await import("../src/lib/autopilot/findings");
  const { claimAutopilotRun, finishAutopilotRun, buildAutopilotRunContext } =
    await import("../src/lib/autopilot/run");
  const { postAutopilotBrief, buildAutopilotBrief } =
    await import("../src/lib/autopilot/brief");
  const { startAutopilot } = await import("../src/lib/autopilot/start");
  const {
    renewAutopilotFindingLease,
    renewAutopilotRunLease,
    withAutopilotFindingLease,
  } = await import("../src/lib/autopilot/leases");
  const {
    createAutopilotLogger,
    listRunEvents,
    purgeExpiredAutopilotTraceDetails,
  } = await import("../src/lib/autopilot/log");
  const { loadAdminTrace, listAdminRuns } =
    await import("../src/lib/autopilot/admin");
  const { loadAutopilotMetrics } = await import("../src/lib/autopilot/metrics");
  const { autopilotDraftBranchSlug } =
    await import("../src/utils/autopilot-branches");
  const { withHeartbeat } = await import("../src/utils/autopilot-leases");
  const now = new Date();
  const old = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const brief = {
    topic: "Sandbox exports",
    angle: "Explain exports",
    evidence: "A sandbox change",
  };
  const proposal = {
    kind: "commits" as const,
    fingerprint: "commits:sandbox/app#1",
    title: "Exports",
    summary: "Sandbox only",
    evidence: { brief },
  };

  beforeAll(async () => {
    await db.insert(organizations).values([
      {
        id: "sandbox-org",
        name: "Autopilot sandbox",
        slug: "autopilot-sandbox",
        createdAt: now,
      },
      {
        id: "other-org",
        name: "Other sandbox",
        slug: "other-sandbox",
        createdAt: now,
      },
    ]);
  });
  afterAll(() => sandbox.postgres.close());
  beforeEach(async () => {
    startup.finishBeforeError = false;
    startup.flag = true;
    await sandbox.postgres.exec(
      'TRUNCATE "autopilot_runs" CASCADE; TRUNCATE "autopilot_settings" CASCADE;'
    );
    await db.insert(autopilotRuns).values({
      id: "item-run",
      organizationId: "sandbox-org",
      trigger: "suggestion",
    });
  });

  test("a revoked flag blocks resumed jobs and Slack delivery", async () => {
    startup.flag = false;
    await expect(
      buildAutopilotRunContext("sandbox-org", "item-run")
    ).rejects.toThrow("not available");
    expect(
      await postAutopilotBrief(
        "sandbox-org",
        { text: "Must not send", blocks: [], items: [] },
        "item-run"
      )
    ).toBeNull();
  });

  test("Slack briefs escape external text and stay within Block Kit limits", async () => {
    const claim = await claimFinding("sandbox-org", "item-run", proposal);
    if (!claim) {
      throw new Error("Expected a claim");
    }
    const finding = {
      ...claim.finding,
      title: "<!channel> & updates",
      summary: "x".repeat(5000),
    };
    const brief = buildAutopilotBrief({
      organizationSlug: "sandbox",
      proposed: Array.from({ length: 20 }, () => finding),
      merged: Array.from({ length: 20 }, () => finding),
      insights: Array.from({ length: 20 }, () => `<!here> ${"x".repeat(500)}`),
    });
    expect(brief).not.toBeNull();
    if (!brief) {
      throw new Error("Expected a brief");
    }
    expect(brief.items).toHaveLength(5);
    const blocks = [brief, ...brief.items].flatMap((message) => {
      expect(message.blocks.length).toBeLessThanOrEqual(50);
      return message.blocks;
    });
    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toContain("<!channel>");
    expect(serialized).not.toContain("<!here>");
    for (const block of blocks) {
      const text = block.text as { text?: string } | undefined;
      if (text?.text) {
        expect(text.text.length).toBeLessThanOrEqual(3000);
      }
      if (block.type === "context") {
        const elements = block.elements as { text: string }[];
        expect(elements.length).toBeLessThanOrEqual(10);
        for (const element of elements) {
          expect(element.text.length).toBeLessThanOrEqual(3000);
        }
      }
    }
  });

  test("migrated unique constraints allow exactly one full run per workspace", async () => {
    const claims = await Promise.all([
      claimAutopilotRun("sandbox-org", "cron", "autopilot.daily"),
      claimAutopilotRun("sandbox-org", "manual", "autopilot.daily"),
    ]);
    expect(claims.filter((claim) => !claim.alreadyRunning)).toHaveLength(1);
    expect(claims[0]?.runId).toBe(claims[1]?.runId);
    expect(
      await claimAutopilotRun("other-org", "cron", "autopilot.daily")
    ).toMatchObject({
      alreadyRunning: false,
    });
  });

  test("fresh proposals preserve failure history across separate runs and stop after three attempts", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const runId = `retry-${attempt}`;
      await db.insert(autopilotRuns).values({
        id: runId,
        organizationId: "sandbox-org",
        trigger: "github",
      });
      const claim = await claimFinding("sandbox-org", runId, {
        ...proposal,
        evidence: { brief },
      });
      if (!claim) {
        throw new Error("Expected a retry claim");
      }
      expect(claim.finding.evidence.failures ?? 0).toBe(attempt);
      expect(await markFindingFailed(claim, "Writer failed")).toBe(
        attempt === 2
      );
    }
    expect(
      await claimFinding("sandbox-org", "item-run", {
        ...proposal,
        evidence: { brief },
      })
    ).toBeNull();
    expect(
      (await listSettledFingerprints("sandbox-org", "commits")).has(
        proposal.fingerprint
      )
    ).toBe(true);
  });

  test("slot reservations are idempotent and live claims release them when settled", async () => {
    await db.insert(autopilotSettings).values({
      organizationId: "sandbox-org",
      enabled: true,
      maxOpenPullRequests: 1,
    });
    const first = await claimFinding("sandbox-org", "item-run", proposal);
    const other = await claimFinding("sandbox-org", "item-run", {
      ...proposal,
      fingerprint: "commits:sandbox/app#2",
    });
    if (!(first && other)) {
      throw new Error("Expected two topic claims");
    }
    expect(await reserveDraftSlot(first, 1)).toBe("reserved");
    expect(await reserveDraftSlot(first, 1)).toBe("reserved");
    expect(await countOpenPullRequests("sandbox-org")).toBe(1);
    expect(await reserveDraftSlot(other, 1)).toBe("full");
    await markFindingFailed(first, "Failed");
    expect(await reserveDraftSlot(other, 1)).toBe("reserved");
    expect(await reserveDraftSlot(first, null)).toBe("lost");
  });

  test("a renewed heartbeat protects an old full run, and a lost heartbeat is recovered", async () => {
    await db.insert(autopilotRuns).values({
      id: "long-run",
      organizationId: "sandbox-org",
      trigger: "cron",
      startedAt: old,
      heartbeatAt: old,
    });
    expect(
      await renewAutopilotRunLease({
        organizationId: "sandbox-org",
        runId: "long-run",
      })
    ).toBe(true);
    expect(
      await claimAutopilotRun("sandbox-org", "manual", "autopilot.daily")
    ).toEqual({
      runId: "long-run",
      alreadyRunning: true,
    });
    await db
      .update(autopilotRuns)
      .set({ heartbeatAt: old })
      .where(eq(autopilotRuns.id, "long-run"));
    expect(
      await claimAutopilotRun("sandbox-org", "manual", "autopilot.daily")
    ).toMatchObject({
      alreadyRunning: false,
    });
    const replaced = await db.query.autopilotRuns.findFirst({
      where: eq(autopilotRuns.id, "long-run"),
    });
    expect(replaced?.status).toBe("failed");
  });

  for (const trigger of ["suggestion", "cron"] as const) {
    test(`automatic budget checks recover a dead ${trigger} slot without a dashboard visit`, async () => {
      await db
        .update(autopilotRuns)
        .set({ trigger })
        .where(eq(autopilotRuns.id, "item-run"));
      await db.insert(autopilotSettings).values({
        organizationId: "sandbox-org",
        enabled: true,
        maxOpenPullRequests: 1,
      });
      const claim = await claimFinding("sandbox-org", "item-run", proposal);
      if (!claim) {
        throw new Error("Expected a claim");
      }
      expect(await reserveDraftSlot(claim, 1)).toBe("reserved");
      await db
        .update(autopilotFindings)
        .set({ claimedAt: old })
        .where(eq(autopilotFindings.id, claim.finding.id));
      await db
        .update(autopilotRuns)
        .set({ heartbeatAt: old })
        .where(eq(autopilotRuns.id, "item-run"));
      expect(await countOpenPullRequests("sandbox-org")).toBe(0);
      expect(await renewAutopilotFindingLease(claim)).toBe(false);
      expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
        "suggested"
      );
    });
  }

  test("concurrent candidate claims deduplicate real rows and refresh only their own lease", async () => {
    const claims = await Promise.all([
      claimFinding("sandbox-org", "item-run", proposal),
      claimFinding("sandbox-org", "item-run", proposal),
    ]);
    const claim = claims.find((value) => value !== null);
    expect(claims.filter(Boolean)).toHaveLength(1);
    if (!claim) {
      throw new Error("Expected a claim");
    }
    await db
      .update(autopilotFindings)
      .set({ claimedAt: old })
      .where(eq(autopilotFindings.id, claim.finding.id));
    expect(await renewAutopilotFindingLease(claim)).toBe(true);
    expect(await claimFinding("sandbox-org", "item-run", proposal)).toBeNull();
    expect(
      await renewAutopilotFindingLease({ ...claim, token: "wrong-token" })
    ).toBe(false);
    expect(
      await renewAutopilotRunLease({
        organizationId: "other-org",
        runId: "item-run",
      })
    ).toBe(false);
  });

  for (const stillOwned of [true, false]) {
    test(`a missed heartbeat rechecks ownership at completion: ${stillOwned}`, async () => {
      let calls = 0;
      const renew = mock(async () => {
        calls++;
        return calls === 1 || (calls === 3 && stillOwned);
      });
      const timer = spyOn(globalThis, "setInterval");
      try {
        const result = withHeartbeat(
          renew,
          async () => {
            const tick = timer.mock.calls[0]?.[0];
            if (typeof tick !== "function") {
              throw new Error("Expected a timer");
            }
            tick();
            await Promise.resolve();
            return "completed";
          },
          60_000
        );
        if (stillOwned) {
          await expect(result).resolves.toBe("completed");
        } else {
          await expect(result).rejects.toThrow("lease was lost while working");
        }
        expect(renew).toHaveBeenCalledTimes(3);
      } finally {
        timer.mockRestore();
      }
    });
  }

  test("a heartbeat query error after recording a PR does not turn success into failure", async () => {
    const claim = await claimFinding("sandbox-org", "item-run", proposal);
    if (!claim) {
      throw new Error("Expected a claim");
    }
    const operation = mock(async () => "must not run");
    const initialUpdate = spyOn(db, "update").mockImplementationOnce(() => {
      throw new Error("Fixture initial renewal failed");
    });
    try {
      await expect(withAutopilotFindingLease(claim, operation)).rejects.toThrow(
        "Fixture initial renewal failed"
      );
      expect(operation).not.toHaveBeenCalled();
    } finally {
      initialUpdate.mockRestore();
    }
    const timer = spyOn(globalThis, "setInterval");
    try {
      await expect(
        withAutopilotFindingLease(claim, async () => {
          expect(
            await markFindingProposed(claim, {
              repository: "sandbox/site",
              number: 1,
              url: "https://github.com/sandbox/site/pull/1",
              branch: "notra/autopilot/heartbeat",
              headSha: "head",
            })
          ).toBe(true);
          const update = spyOn(db, "update").mockImplementationOnce(() => {
            throw new Error("Fixture heartbeat query failed");
          });
          try {
            const tick = timer.mock.calls[0]?.[0];
            if (typeof tick !== "function") {
              throw new Error("Expected a heartbeat timer");
            }
            tick();
            await Promise.resolve();
            return "recorded";
          } finally {
            update.mockRestore();
          }
        })
      ).resolves.toBe("recorded");
    } finally {
      timer.mockRestore();
    }
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "proposed"
    );
  });

  test("a takeover cannot record a late writer or share its draft branch", async () => {
    const first = await claimFinding("sandbox-org", "item-run", proposal);
    if (!first) {
      throw new Error("Expected first claim");
    }
    await db
      .update(autopilotFindings)
      .set({ claimedAt: old })
      .where(eq(autopilotFindings.id, first.finding.id));
    const replacement = await claimFinding("sandbox-org", "item-run", proposal);
    if (!replacement) {
      throw new Error("Expected replacement claim");
    }
    expect(autopilotDraftBranchSlug("blog", first)).not.toBe(
      autopilotDraftBranchSlug("blog", replacement)
    );
    expect(autopilotDraftBranchSlug("blog", first)).not.toContain(first.token);
    const pull = {
      repository: "sandbox/website",
      number: 1,
      url: "https://github.com/sandbox/website/pull/1",
      branch: autopilotDraftBranchSlug("blog", replacement),
      headSha: "abc",
    };
    expect(await markFindingProposed(replacement, pull)).toBe(true);
    expect(await markFindingProposed(first, { ...pull, number: 2 })).toBe(
      false
    );
    expect(
      (
        await db.query.autopilotFindings.findFirst({
          where: eq(autopilotFindings.id, first.finding.id),
        })
      )?.pullRequestNumber
    ).toBe(1);
  });

  test("finishing after an error preserves an already delivered Slack message", async () => {
    await db
      .update(autopilotRuns)
      .set({ slackMessageTs: "1234567890.000001" })
      .where(eq(autopilotRuns.id, "item-run"));
    await finishAutopilotRun({
      organizationId: "sandbox-org",
      runId: "item-run",
      results: [],
      slackMessageTs: null,
      error: "Fixture completion failed after delivery",
      scheduled: false,
    });
    const run = await db.query.autopilotRuns.findFirst({
      where: eq(autopilotRuns.id, "item-run"),
    });
    expect(run?.status).toBe("failed");
    expect(run?.slackMessageTs).toBe("1234567890.000001");
  });

  test("failed runs cannot be resurrected or advance the daily schedule by finishing late", async () => {
    await db
      .insert(autopilotSettings)
      .values({ organizationId: "sandbox-org", lastRunAt: old });
    await db
      .update(autopilotRuns)
      .set({ status: "failed" })
      .where(eq(autopilotRuns.id, "item-run"));
    await finishAutopilotRun({
      organizationId: "sandbox-org",
      runId: "item-run",
      results: [],
      slackMessageTs: null,
    });
    expect(
      (
        await db.query.autopilotRuns.findFirst({
          where: eq(autopilotRuns.id, "item-run"),
        })
      )?.status
    ).toBe("failed");
    expect(
      (await db.query.autopilotSettings.findFirst())?.lastRunAt?.getTime()
    ).toBe(old.getTime());
  });

  test("a late launch error cannot turn an already completed workflow into a failure", async () => {
    await db
      .insert(autopilotSettings)
      .values({ organizationId: "sandbox-org", enabled: true });
    startup.finishBeforeError = true;
    await expect(startAutopilot("sandbox-org", "manual")).rejects.toThrow(
      "Lost the launch response"
    );
    const run = await db.query.autopilotRuns.findFirst({
      where: eq(autopilotRuns.trigger, "manual"),
    });
    expect(run?.status).toBe("completed");
  });

  test("paused workspaces reject Run now before claiming or enqueuing", async () => {
    await db
      .insert(autopilotSettings)
      .values({ organizationId: "sandbox-org", enabled: false });
    await expect(startAutopilot("sandbox-org", "manual")).rejects.toThrow(
      "Turn on Autopilot"
    );
    expect(
      await db.query.autopilotRuns.findMany({
        where: eq(autopilotRuns.trigger, "manual"),
      })
    ).toHaveLength(0);
  });

  test("dead suggestions recover without touching other workspaces or merged history", async () => {
    const claim = await claimFinding("sandbox-org", "item-run", proposal);
    if (!claim) {
      throw new Error("Expected claim");
    }
    await db
      .update(autopilotFindings)
      .set({ claimedAt: old })
      .where(eq(autopilotFindings.id, claim.finding.id));
    expect(await recoverStaleFindings("other-org", now)).toBe(0);
    expect(await recoverStaleFindings("sandbox-org", now)).toBe(1);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    await db
      .update(autopilotFindings)
      .set({ status: "merged" })
      .where(eq(autopilotFindings.id, claim.finding.id));
    await expect(
      dismissFinding("sandbox-org", claim.finding.id)
    ).rejects.toThrow("already merged");
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "merged"
    );
  });

  test("admin traces are opt-in, credentials are redacted, members never see internal payloads", async () => {
    const log = createAutopilotLogger(
      { organizationId: "sandbox-org", runId: "item-run" },
      "commits"
    );
    await log.action(
      "Used a model",
      { inputTokens: 12, outputTokens: 3 },
      {
        authorization: "Bearer fixture-credential",
        prompt: "Bearer sandbox-secret",
        nested: { apiKey: "fixture-key" },
      }
    );
    await log.trace("Candidate rejected", {
      reason: "private source material",
    });
    const members = await listRunEvents("sandbox-org", "item-run");
    expect(members).toHaveLength(1);
    expect(members[0]).not.toHaveProperty("detail");
    expect(await listRunEvents("other-org", "item-run")).toHaveLength(0);
    const summary = await loadAdminTrace("item-run");
    expect(summary?.events.every((event) => event.detail === null)).toBe(true);
    const sensitive = await loadAdminTrace("item-run", true);
    expect(
      autopilotAdminTraceResponseSchema.safeParse(
        await Response.json(sensitive).json()
      ).success
    ).toBe(true);
    expect(JSON.stringify(sensitive)).not.toContain("fixture-key");
    expect(JSON.stringify(sensitive)).not.toContain("sandbox-secret");
    expect(JSON.stringify(sensitive)).toContain("[redacted]");
    expect(sensitive?.events[0]?.data?.inputTokens).toBe(12);
    expect(await listAdminRuns({ organizationId: "other-org" })).toHaveLength(
      0
    );
  });

  test("retention removes only expired raw payloads, retaining summarized history", async () => {
    const expired = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    await db.insert(autopilotRunEvents).values([
      {
        id: "old",
        organizationId: "sandbox-org",
        runId: "item-run",
        level: "info",
        message: "Old summary",
        detail: { prompt: "old source" },
        createdAt: expired,
      },
      {
        id: "new",
        organizationId: "sandbox-org",
        runId: "item-run",
        level: "info",
        message: "New summary",
        detail: { prompt: "fresh source" },
        createdAt: now,
      },
    ]);
    const before = await loadAdminTrace("item-run", true);
    expect(
      before?.events.find((event) => event.id === "old")?.detail
    ).toBeNull();
    await purgeExpiredAutopilotTraceDetails(now);
    const rows = await db.select().from(autopilotRunEvents);
    expect(rows.find((event) => event.id === "old")?.detail).toBeNull();
    expect(rows.find((event) => event.id === "old")?.message).toBe(
      "Old summary"
    );
    expect(rows.find((event) => event.id === "new")?.detail).toEqual({
      prompt: "fresh source",
    });
  });

  test("cursor pagination does not skip runs with the same timestamp", async () => {
    await db.insert(autopilotRuns).values(
      ["a", "b", "c"].map((id) => ({
        id,
        organizationId: "sandbox-org",
        trigger: "github" as const,
        startedAt: old,
        status: "completed" as const,
      }))
    );
    const first = await listAdminRuns({ status: "completed", limit: 2 });
    const last = first.at(-1);
    if (!last) {
      throw new Error("Expected a page");
    }
    const second = await listAdminRuns({
      status: "completed",
      limit: 2,
      before: last.startedAt.toISOString(),
      beforeId: last.id,
    });
    expect([...first, ...second].map((run) => run.id)).toEqual(["c", "b", "a"]);
  });

  test("automation metrics use event dates, deduplicate PRs and isolate workspaces", async () => {
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    await db.insert(autopilotRuns).values({
      id: "foreign-run",
      organizationId: "other-org",
      trigger: "manual",
    });
    await db.insert(autopilotRunEvents).values([
      {
        id: "pr",
        organizationId: "sandbox-org",
        runId: "item-run",
        job: "commits",
        level: "action",
        message: "Opened pull request #1",
        data: {
          event: "pull_request_created",
          url: "https://github.com/sandbox/app/pull/1",
        },
        createdAt: now,
      },
      {
        id: "duplicate",
        organizationId: "sandbox-org",
        runId: "item-run",
        job: "commits",
        level: "action",
        message: "Opened pull request #1",
        data: { url: "https://github.com/sandbox/app/pull/1" },
        createdAt: now,
      },
      {
        id: "older-pr",
        organizationId: "sandbox-org",
        runId: "item-run",
        job: "readiness",
        level: "action",
        message: "Opened pull request #2",
        data: { url: "https://github.com/sandbox/app/pull/2" },
        createdAt: eightDaysAgo,
      },
      {
        id: "not-a-pr",
        organizationId: "sandbox-org",
        runId: "item-run",
        job: "commits",
        level: "action",
        message: "Reviewed a pull request",
        data: { url: "https://github.com/sandbox/app/pull/3" },
        createdAt: now,
      },
      {
        id: "charge",
        organizationId: "sandbox-org",
        runId: "item-run",
        job: "commits",
        level: "action",
        message: "Charged 8 credits",
        data: { event: "credits_charged", credits: 8 },
        createdAt: now,
      },
      {
        id: "foreign-pr",
        organizationId: "other-org",
        runId: "foreign-run",
        job: "commits",
        level: "action",
        message: "Opened pull request #4",
        data: {
          event: "pull_request_created",
          url: "https://github.com/sandbox/app/pull/4",
        },
        createdAt: now,
      },
    ]);
    await db.insert(autopilotFindings).values({
      id: "merged-finding",
      organizationId: "sandbox-org",
      runId: "item-run",
      kind: "readiness",
      fingerprint: "merged-metric",
      title: "Fix",
      summary: "Fixed",
      status: "merged",
      createdAt: eightDaysAgo,
      mergedAt: now,
    });
    const week = await loadAutopilotMetrics("sandbox-org", 7, now);
    expect(week.pullRequests).toBe(1);
    expect(week.merged).toBe(1);
    expect(week.totalCredits).toBe(8);
    const commits = week.automations.find((row) => row.kind === "commits");
    expect(commits?.pullRequests).toBe(1);
    expect(commits?.creditsPerRun).toBe(8);
    // Only the automations that open pull requests are listed.
    expect(week.automations.map((row) => row.kind)).toEqual([
      "readiness",
      "keywords",
      "commits",
    ]);
    expect(
      (await loadAutopilotMetrics("sandbox-org", 30, now)).pullRequests
    ).toBe(2);
    expect((await loadAutopilotMetrics("other-org", 7, now)).pullRequests).toBe(
      1
    );
  });
}
