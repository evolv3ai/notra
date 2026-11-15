import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_SCHEDULE_TEST !== "1") {
  test("feedback failures do not block daily Autopilot runs", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: { PATH: process.env.PATH, NOTRA_SCHEDULE_TEST: "1" },
        timeout: 30000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  });
} else {
  const start = mock(async () => ({ alreadyRunning: false }));
  mock.module("@notra/db/drizzle", () => ({
    db: {
      query: {
        autopilotSettings: {
          findMany: async () => [{ organizationId: "org-a" }],
        },
      },
    },
  }));
  mock.module("@/lib/autopilot/flag", () => ({
    isAutopilotEnabledForOrganization: async () => true,
  }));
  mock.module("@/lib/autopilot/findings", () => ({
    syncOfferReactionFeedback: async () => {
      throw new Error("Old repository disconnected");
    },
  }));
  mock.module("@/lib/autopilot/log", () => ({
    purgeExpiredAutopilotTraceDetails: async () => undefined,
  }));
  mock.module("@/utils/autopilot-schedule", () => ({
    isAutopilotDue: () => true,
  }));
  mock.module("@/lib/autopilot/start", () => ({ startAutopilot: start }));
  const { runDueAutopilots } = await import("../src/lib/autopilot/schedule");

  test("reports failed feedback while starting a due run", async () => {
    expect(await runDueAutopilots()).toEqual({
      checked: 1,
      started: 1,
      failed: 1,
    });
    expect(start).toHaveBeenCalledWith("org-a", "cron");
  });
}
