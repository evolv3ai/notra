import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { call } from "@orpc/server";

if (process.env.NOTRA_AUTOPILOT_ROUTER_TEST !== "1") {
  test("autopilot save validates projects and sync is admin-only", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_AUTOPILOT_ROUTER_TEST: "1",
          DATABASE_URL: "",
          NEXT_PUBLIC_DEMO_MODE: "false",
        },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stderr?.toString()).toBe(0);
  }, 25_000);
} else {
  const state = {
    role: "admin",
    flag: true,
  };
  const writes: { insert?: Record<string, unknown>; update?: unknown }[] = [];
  const findFirstProject = mock(async () => undefined as unknown);
  const sync = mock(async () => undefined);
  const loadSuggestion = mock(async (_org: string, _id: string) => undefined);
  const calls: string[] = [];
  const createRun = mock(async (_org: string, _trigger: string) => {
    calls.push("create");
    return "run_queued";
  });
  const finishRun = mock(async (_params: Record<string, unknown>) => {
    calls.push("finish");
  });
  const enqueueSuggestion = mock(async (_payload: unknown) => {
    calls.push("enqueue");
    return { runId: "workflow-1" };
  });
  mock.module("@/lib/autopilot/suggestions", () => ({
    loadSuggestedPost: loadSuggestion,
  }));
  mock.module("@/lib/workflows/start", () => ({
    startAutopilotSuggestionWorkflowRun: enqueueSuggestion,
    startWorkflowGraphRun: async () => ({ runId: "workflow-1" }),
  }));

  mock.module("@notra/db/drizzle", () => ({
    db: {
      query: {
        projects: { findFirst: findFirstProject },
        slackIntegrations: { findFirst: async () => undefined },
      },
      insert: () => ({
        values: (insert: Record<string, unknown>) => ({
          onConflictDoUpdate: async ({ set }: { set: unknown }) => {
            writes.push({ insert, update: set });
          },
        }),
      }),
    },
  }));
  mock.module("@/lib/auth/organization", () => ({
    assertAuthenticated: async () => ({
      session: {},
      user: { id: "user_fixture" },
    }),
    assertOrganizationAccess: async () => ({
      membership: { role: state.role },
    }),
  }));
  mock.module("@/lib/autopilot/flag", () => ({
    isAutopilotEnabledForOrganization: async () => state.flag,
    isAutopilotWorkflowGraphEnabled: async () => state.flag,
  }));
  const findings = await import("@/lib/autopilot/findings");
  mock.module("@/lib/autopilot/findings", () => ({
    ...findings,
    syncFindingPullRequests: sync,
  }));
  const run = await import("@/lib/autopilot/run");
  mock.module("@/lib/autopilot/run", () => ({
    ...run,
    createItemAutopilotRun: createRun,
    finishAutopilotRun: finishRun,
  }));

  const { autopilotRouter } = await import("./autopilot");
  const { createORPCContext } = await import("../context");
  const context = await createORPCContext({ headers: new Headers() });

  const saveInput = {
    organizationId: "org_fixture",
    enabled: true,
    repository: { owner: "acme", name: "site", branch: "main" },
    contentPath: null,
    slack: null,
    briefHour: 9,
    timezone: "Europe/Berlin",
    jobs: {
      readiness: true,
      keywords: true,
      commits: true,
      prompts: true,
      competitors: true,
    },
    maxOpenPullRequests: 3,
  };

  test("save stores a project the workspace owns", async () => {
    writes.length = 0;
    findFirstProject.mockImplementation(async () => ({ id: "project_b" }));
    await call(
      autopilotRouter.save,
      { ...saveInput, projectId: "project_b" },
      { context }
    );
    expect(writes.at(-1)?.insert).toMatchObject({ projectId: "project_b" });
    expect(writes.at(-1)?.update).toMatchObject({ projectId: "project_b" });
  });

  test("save rejects a project from another workspace", async () => {
    writes.length = 0;
    findFirstProject.mockImplementation(async () => undefined);
    await expect(
      call(
        autopilotRouter.save,
        { ...saveInput, projectId: "project_foreign" },
        { context }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(writes).toHaveLength(0);
  });

  test("save without a project keeps the saved one", async () => {
    writes.length = 0;
    findFirstProject.mockClear();
    await call(autopilotRouter.save, saveInput, { context });
    expect(findFirstProject).not.toHaveBeenCalled();
    expect(writes.at(-1)?.update).not.toHaveProperty("projectId");
  });

  test("sync needs an admin and the Autopilot flag", async () => {
    sync.mockClear();
    state.role = "member";
    await expect(
      call(autopilotRouter.sync, { organizationId: "org_fixture" }, { context })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.role = "admin";
    state.flag = false;
    await expect(
      call(autopilotRouter.sync, { organizationId: "org_fixture" }, { context })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(sync).not.toHaveBeenCalled();
    state.flag = true;
    await call(
      autopilotRouter.sync,
      { organizationId: "org_fixture" },
      { context }
    );
    expect(sync).toHaveBeenCalledWith("org_fixture");
  });

  test("Write now queues a visible run and settles it if enqueue fails", async () => {
    for (const fn of [
      enqueueSuggestion,
      loadSuggestion,
      createRun,
      finishRun,
    ]) {
      fn.mockClear();
    }
    calls.length = 0;
    state.flag = true;
    state.role = "member";
    const input = { organizationId: "org_fixture", findingId: "idea" };
    await expect(
      call(autopilotRouter.writeSuggestion, input, { context })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(enqueueSuggestion).not.toHaveBeenCalled();
    expect(loadSuggestion).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    state.role = "admin";
    enqueueSuggestion.mockImplementationOnce(async () => {
      calls.push("enqueue");
      throw new Error("queue unavailable");
    });
    await expect(
      call(autopilotRouter.writeSuggestion, input, { context })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(calls).toEqual(["create", "enqueue", "finish"]);
    expect(finishRun).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_fixture",
        runId: "run_queued",
        error: "queue unavailable",
      })
    );
    calls.length = 0;
    expect(
      await call(autopilotRouter.writeSuggestion, input, { context })
    ).toEqual({ success: true });
    // The running row exists before the worker starts, so polling keeps going.
    expect(calls).toEqual(["create", "enqueue"]);
    expect(createRun).toHaveBeenLastCalledWith("org_fixture", "suggestion");
    expect(enqueueSuggestion).toHaveBeenLastCalledWith({
      ...input,
      runId: "run_queued",
    });
    expect(loadSuggestion).toHaveBeenCalledWith("org_fixture", "idea");
    expect(enqueueSuggestion).toHaveBeenCalledTimes(2);
  });
}
