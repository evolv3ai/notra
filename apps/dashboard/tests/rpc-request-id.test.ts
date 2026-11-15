import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { DrainContext, WideEvent } from "evlog";

if (process.env.NOTRA_RPC_REQUEST_ID_TEST !== "1") {
  test("RPC analytics receives only intake-validated request IDs", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_RPC_REQUEST_ID_TEST: "1",
          DATABASE_URL: "",
        },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stderr?.toString()).toBe(0);
  }, 25_000);
} else {
  const rich: WideEvent[] = [];
  mock.module("@notra/ai/utils/evlog-runtime", () => ({
    getEvlogRuntime: () => ({
      aiDrain: Object.assign(
        ({ event }: DrainContext) => {
          rich.push(event);
        },
        { flush: async () => {} }
      ),
    }),
  }));
  const capture = mock((input: unknown) => input);
  const pending: Promise<unknown>[] = [];
  mock.module("@/lib/analytics/posthog-server", () => ({
    trackServerEvent: capture,
    trackServerException: mock(() => {}),
  }));
  mock.module("@/lib/framework/after-response", () => ({
    afterResponse: (task: () => Promise<unknown>) => {
      pending.push(task());
    },
  }));
  mock.module("@/lib/orpc/router", () => ({ dashboardRouter: {} }));
  mock.module("@/lib/orpc/handler-plugins", () => ({
    createDashboardHandlerPlugins: () => [],
  }));
  mock.module("@/lib/orpc/utils/localize-server-failure", () => ({
    localizeServerFailure: async (error: unknown) => error,
  }));
  const { GET } = await import("../src/app/rpc/[[...rest]]/route");
  const { telemetryValue } = await import("@notra/ai/utils/telemetry-value");
  test("real RPC route copies the safe logger ID into mocked PostHog and emits it once", async () => {
    for (const candidate of [
      "req_fixture",
      "header.payload.signature",
      "request:header.payload.signature:1",
      "sk_fixture_credential",
    ]) {
      capture.mockClear();
      rich.length = 0;
      pending.length = 0;
      const response = await GET(
        new Request("https://fixture.invalid/rpc/missing", {
          headers: { "x-request-id": candidate },
        })
      );
      await response.text();
      await Promise.all(pending);
      expect(response.status).toBe(404);
      expect(capture).toHaveBeenCalledTimes(1);
      const id = rich[0]?.requestId;
      expect(telemetryValue("requestId", id)).toBe(true);
      expect(rich).toHaveLength(1);
      expect(capture.mock.calls[0]?.[0]).toMatchObject({
        properties: { request_id: id },
      });
      expect(id === candidate).toBe(telemetryValue("requestId", candidate));
    }
  });
}
