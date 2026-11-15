import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_AUTOPILOT_ITEM_WORKFLOW_TEST !== "1") {
  test("Autopilot item workflows own background work and webhook admission", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_AUTOPILOT_ITEM_WORKFLOW_TEST: "1",
        },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  });
} else {
  const claim = mock(async () => true);
  const complete = mock(async () => undefined);
  const processEvent = mock(async () => undefined);
  const write = mock(async () => undefined);
  const prepare = mock(
    async (_org: string, _finding: string, _runId?: string) => {
      await write();
    }
  );
  const enqueue = mock(async (_input: unknown) => ({ runId: "workflow-1" }));
  let httpStatus = 202;
  mock.module("@/workflows/runtime", () => ({}));
  mock.module("workflow", () => ({
    getWorkflowMetadata: () => ({ workflowRunId: "workflow-1" }),
  }));
  mock.module("@notra/ai/utils/github-mention-delivery", () => ({
    claimGitHubMentionDelivery: claim,
    completeGitHubMentionDelivery: complete,
  }));
  mock.module("@/lib/autopilot/pull-request-events", () => ({
    handleAutopilotPullRequestEvent: processEvent,
  }));
  mock.module("@/lib/autopilot/suggestions", () => ({
    writeSuggestedPost: prepare,
  }));
  mock.module("@notra/ai/evlog", () => ({
    withEvlog: (handler: unknown) => handler,
  }));
  mock.module("@notra/ai/utils/github-mention-ingest", () => ({
    getGitHubAppWebhookSecret: () => null,
    ingestGitHubAppMentionWebhook: async () => ({
      httpStatus,
      body: { accepted: httpStatus < 400 },
    }),
  }));
  mock.module("@/lib/workflows/start", () => ({
    startAutopilotPullRequestWorkflowRun: enqueue,
    startGitHubMentionRun: async () => undefined,
  }));
  mock.module("@/lib/webhooks/github-mention-log", () => ({
    writeMentionWebhookLog: async () => undefined,
  }));
  const { autopilotPullRequestWorkflow } =
    await import("./autopilot-pull-request");
  const { autopilotSuggestionWorkflow } =
    await import("./autopilot-suggestion");
  const { processAutopilotPullRequestStep, writeAutopilotSuggestionStep } =
    await import("./steps/autopilot-item-steps");
  const { POST } = await import("../app/api/webhooks/github/app/route");
  const request = (deliveryId = "delivery-1") =>
    new Request("http://localhost/api/webhooks/github/app", {
      method: "POST",
      headers: {
        "x-github-event": "pull_request",
        ...(deliveryId ? { "x-github-delivery": deliveryId } : {}),
      },
      body: "{}",
    });
  beforeEach(() => {
    for (const fn of [claim, complete, processEvent, write, prepare, enqueue]) {
      fn.mockClear();
    }
    claim.mockResolvedValue(true);
    processEvent.mockResolvedValue(undefined);
    enqueue.mockResolvedValue({ runId: "workflow-1" });
    httpStatus = 202;
  });
  test("Write now claims and reserves credits inside the workflow, not the request", async () => {
    expect(prepare).not.toHaveBeenCalled();
    await autopilotSuggestionWorkflow({
      organizationId: "org",
      findingId: "idea",
    });
    expect(prepare).toHaveBeenCalledWith("org", "idea", undefined);
    await autopilotSuggestionWorkflow({
      organizationId: "org",
      findingId: "idea",
      runId: "run_queued",
    });
    // The worker settles the run Write now created instead of opening another.
    expect(prepare).toHaveBeenLastCalledWith("org", "idea", "run_queued");
    expect(write).toHaveBeenCalledTimes(2);
    expect(writeAutopilotSuggestionStep.maxRetries).toBe(0);
  });
  test("a delivery is namespaced and only the owning workflow processes it", async () => {
    claim.mockResolvedValueOnce(false);
    const payload = { deliveryId: "delivery-1", rawBody: "{}" };
    await autopilotPullRequestWorkflow(payload);
    expect(processEvent).not.toHaveBeenCalled();
    await autopilotPullRequestWorkflow(payload);
    expect(claim).toHaveBeenLastCalledWith(
      "autopilot:delivery-1",
      "workflow-1"
    );
    expect(processEvent).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("autopilot:delivery-1", "workflow-1");
  });
  test("a potentially partial external write is not blindly retried or marked complete", async () => {
    processEvent.mockRejectedValueOnce(
      new Error("connection lost after write")
    );
    await expect(
      autopilotPullRequestWorkflow({ deliveryId: "delivery-1", rawBody: "{}" })
    ).rejects.toThrow("connection lost");
    expect(processAutopilotPullRequestStep.maxRetries).toBe(0);
    expect(complete).not.toHaveBeenCalled();
  });
  test("queue failure cannot acknowledge a GitHub webhook", async () => {
    enqueue.mockRejectedValueOnce(new Error("queue unavailable"));
    await expect(POST(request() as never)).rejects.toThrow("queue unavailable");
    expect(processEvent).not.toHaveBeenCalled();
    expect((await POST(request() as never)).status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith({
      rawBody: "{}",
      deliveryId: "delivery-1",
    });
  });
  test("invalid signatures and missing delivery IDs never enqueue work", async () => {
    httpStatus = 401;
    expect((await POST(request() as never)).status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
    httpStatus = 202;
    expect((await POST(request("") as never)).status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });
}
