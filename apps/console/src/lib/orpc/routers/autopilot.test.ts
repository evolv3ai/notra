import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { call } from "@orpc/server";

if (process.env.NOTRA_CONSOLE_AUTOPILOT_TEST !== "1") {
  test("only Notra admins can request Autopilot traces", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          NOTRA_CONSOLE_AUTOPILOT_TEST: "1",
        },
        timeout: 15_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 20_000);
} else {
  let role = "member";
  const request = mock(async (_input: unknown, _schema: unknown) => ({
    runs: [],
  }));
  mock.module("@/lib/auth/organization", () => ({
    assertAuthenticated: async () => ({ user: { id: "sandbox-admin", role } }),
  }));
  mock.module("@/lib/autopilot/dashboard", () => ({
    callAutopilotAdmin: request,
  }));
  const { autopilotRouter } = await import("./autopilot");
  const context = { headers: new Headers() };

  test("members are rejected before contacting the dashboard", async () => {
    role = "member";
    request.mockClear();
    await expect(call(autopilotRouter.runs, {}, { context })).rejects.toThrow();
    await expect(
      call(autopilotRouter.trace, { runId: "run-sandbox" }, { context })
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  test("admin trace requests omit raw details unless explicitly requested", async () => {
    role = "admin";
    request.mockClear();
    await call(autopilotRouter.trace, { runId: "run-sandbox" }, { context });
    expect(request).toHaveBeenLastCalledWith(
      { action: "trace", runId: "run-sandbox", includeDetail: false },
      expect.anything()
    );
    await call(
      autopilotRouter.trace,
      { runId: "run-sandbox", includeDetail: true },
      { context }
    );
    expect(request).toHaveBeenLastCalledWith(
      { action: "trace", runId: "run-sandbox", includeDetail: true },
      expect.anything()
    );
  });
  test("invalid limits and identifiers are rejected before contacting the dashboard", async () => {
    role = "admin";
    request.mockClear();
    await expect(
      call(autopilotRouter.runs, { limit: 1000 }, { context })
    ).rejects.toThrow();
    await expect(
      call(autopilotRouter.trace, { runId: "" }, { context })
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
}
