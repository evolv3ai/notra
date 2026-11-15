import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_CONTENT_BILLING_CONFIRMATION_TEST !== "1") {
  test("billing failures preserve successful event and scheduled content", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_CONTENT_BILLING_CONFIRMATION_TEST: "1",
          DATABASE_URL: "",
        },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 25_000);
} else {
  const finish = mock(async () => undefined);
  const finishRun = mock(async () => undefined);
  const pause = mock(async () => undefined);
  const clearPause = mock(async () => undefined);
  const cleanup = mock(async () => undefined);
  const appendLog = mock(async () => undefined);
  const trackOutcome = mock(async () => undefined);
  const enqueueDigest = mock(async () => undefined);
  const finalize = mock(async () => undefined);
  const generate = mock(async () => ({
    status: "success",
    posts: [{ postId: "post-test", title: "Example draft" }],
    usage: null,
  }));
  const trigger = {
    id: "trigger-test",
    name: "Example automation",
    enabled: true,
    organizationId: "org-test",
    outputType: "blog_post",
    outputConfig: null,
    sourceConfig: null,
    sourceType: "cron",
    targets: { repositoryIds: ["repo-test"], linearIntegrationIds: [] },
  };

  mock.module("../src/workflows/steps/automation-run-history", () => ({
    recordAutomationRunStart: async () => undefined,
    recordAutomationRunFinish: finishRun,
  }));
  mock.module("../src/workflows/steps/content-generation-steps", () => ({
    claimWorkflowExecution: async () => ({ claimed: true }),
    fetchEventTrigger: async () => ({ trigger, lookbackWindow: "24h" }),
    fetchScheduleTriggerContext: async () => ({
      trigger,
      lookbackWindow: "24h",
    }),
    gateContentBilling: async () => ({
      allowed: true,
      mode: "plan_quota",
      reserved: true,
      lockId: "expired-lock",
      featureId: "long_form_posts",
      useMarkup: false,
    }),
    fetchEventRepository: async () => ({ id: "repo-test" }),
    fetchScheduleSources: async () => ({
      repositories: [{ id: "repo-test" }],
      linearIntegrationRefs: [],
    }),
    fetchBrandSettingsData: async () => ({}),
    fetchGenerationUserId: async () => "user-test",
    fetchLogRetention: async () => 30,
    fetchNotificationData: async () => ({
      enabled: true,
      ownerEmails: ["owner@example.invalid"],
      organizationName: "Example",
      organizationSlug: "example",
    }),
    notifyContentCreatedInSlack: async () => undefined,
    startGenerationTracking: async () => undefined,
    createGenerationCollection: async () => undefined,
    notifyContentLimitReached: async () => undefined,
    finalizeContentBilling: finalize,
    finishGeneration: finish,
    recordWorkflowPause: pause,
    clearWorkflowPause: clearPause,
    cleanupEmptyCollection: cleanup,
    appendAutomationLog: appendLog,
    trackContentOutcome: trackOutcome,
    enqueueDigest,
  }));
  mock.module("../src/workflows/steps/event-generation-step", () => ({
    runEventGeneration: generate,
  }));
  mock.module("../src/workflows/steps/schedule-generation-step", () => ({
    runScheduledGeneration: generate,
  }));
  const { eventContentWorkflow } =
    await import("../src/workflows/event-content");
  const { scheduleContentWorkflow } =
    await import("../src/workflows/schedule-content");
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => mock.clearAllMocks());

  test.each(["event", "schedule"] as const)(
    "%s keeps drafts, notifications and success status when confirmation fails",
    async (source) => {
      const error = Object.assign(new Error("Billing lock expired"), {
        statusCode: 404,
      });
      finalize.mockRejectedValueOnce(error);
      const result =
        source === "event"
          ? await eventContentWorkflow({
              triggerId: trigger.id,
              eventType: "push",
              eventAction: "",
              eventData: {},
              repositoryId: "repo-test",
              executionId: "execution-test",
            })
          : await scheduleContentWorkflow({
              triggerId: trigger.id,
              executionId: "execution-test",
            });

      expect(result).toMatchObject({ status: "success", postId: "post-test" });
      expect(finalize).toHaveBeenCalledTimes(1);
      expect(finalize).toHaveBeenCalledWith(
        expect.objectContaining({ action: "confirm", units: 1 })
      );
      expect(finish).toHaveBeenCalledTimes(1);
      expect(finishRun).toHaveBeenCalledTimes(1);
      expect(finishRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: "success", postId: "post-test" })
      );
      expect(pause).not.toHaveBeenCalled();
      expect(cleanup).not.toHaveBeenCalled();
      expect(clearPause).toHaveBeenCalledTimes(1);
      expect(appendLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: "success" })
      );
      expect(trackOutcome).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "created" })
      );
      expect(enqueueDigest).toHaveBeenCalledTimes(1);
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining("Billing confirmation failed"),
        error
      );
    }
  );
}
