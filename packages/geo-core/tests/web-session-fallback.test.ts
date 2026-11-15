import { expect, mock, test } from "bun:test";

import type { WebPageViewInput } from "../src/types/ingest";
import {
  isIsolatedTestWorker,
  testInIsolatedProcess,
} from "./utils/isolated-process";

process.env.GEO_INGEST_SECRET = "test-secret";

mock.module("@notra/ai/utils/redis", () => ({ redis: null }));
if (!isIsolatedTestWorker(import.meta.url)) {
  testInIsolatedProcess(
    "web-session-fallback runs with process-isolated module mocks",
    import.meta.url
  );
} else {
  const { buildWebPageView } = await import("../src/ingest/web");

  test("without Redis every view has its own session but retains the daily visitor", async () => {
    const input: WebPageViewInput = {
      identity: { organizationId: "org", projectId: "prj", generation: 1 },
      payload: { method: "GET", url: "https://acme.com/" },
      url: new URL("https://acme.com/"),
      capturedAt: new Date("2026-10-06T12:00:00Z"),
      classification: {
        visitorType: "human",
        source: "human",
        agent: "",
        category: "",
        confidence: "",
      },
    } as WebPageViewInput;
    const rows = await Promise.all([
      buildWebPageView(input),
      buildWebPageView(input),
    ]);
    expect(rows[0]?.visitor_id).toBe(rows[1]?.visitor_id);
    expect(rows[0]?.session_id).not.toBe(rows[1]?.session_id);
    expect(rows.map((row) => row?.session_page_index)).toEqual([0, 0]);
  });
}
