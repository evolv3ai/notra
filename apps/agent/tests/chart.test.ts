import { describe, expect, mock, test } from "bun:test";

import { chartInputSchema } from "../agent/lib/schemas/chart";
import type { ChartInput } from "../agent/lib/types/chart";
import { renderChart } from "../agent/lib/utils/render-chart";
import { uploadSlackChart } from "../agent/lib/utils/slack-chart";
import chartTool from "../agent/tools/create_chart";

const input: ChartInput = {
  type: "line",
  title: "GEO visibility (example data)",
  source: "Synthetic test data · October 1–4, 2026",
  yAxisLabel: "Mention rate (%)",
  labels: ["Oct 1", "Oct 2", "Oct 3", "Oct 4"],
  series: [
    { name: "ChatGPT", values: [20, 28, null, 36] },
    { name: "Perplexity", values: [8, 12, 10, 14] },
  ],
};

describe("Slack data charts", () => {
  test("exposes the chart tool only to Slack and authenticated dashboard relays", async () => {
    const resolveTool = chartTool.events["turn.started"];
    if (!resolveTool) {
      throw new Error("Chart tool must resolve per turn");
    }
    for (const authenticator of [
      "slack-webhook",
      "notra-dashboard-relay",
      "dashboard",
      undefined,
    ]) {
      const tool = await resolveTool(
        {} as never,
        {
          session: { auth: { current: { authenticator } } },
        } as never
      );
      expect(tool !== null).toBe(
        authenticator === "slack-webhook" ||
          authenticator === "notra-dashboard-relay"
      );
    }
  });

  test("validates matching finite data and rejects empty or oversized charts", () => {
    expect(chartInputSchema.safeParse(input).success).toBe(true);
    for (const values of [
      [1],
      [Number.NaN, 1, 2, 3],
      [Infinity, 1, 2, 3],
      [-1e308, 1e308, 0, 1],
      [null, null, null, null],
    ]) {
      expect(
        chartInputSchema.safeParse({
          ...input,
          series: [{ name: "Invalid", values }],
        }).success
      ).toBe(false);
    }
    expect(
      chartInputSchema.safeParse({
        ...input,
        labels: new Array(121).fill("day"),
      }).success
    ).toBe(false);
    expect(
      chartInputSchema.safeParse({
        ...input,
        series: new Array(7).fill(input.series[0]),
      }).success
    ).toBe(false);
  });

  for (const type of ["line", "bar"] as const) {
    test(`renders ${type} charts as PNGs without system fonts`, async () => {
      const png = await renderChart({ ...input, type });
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(1200);
      expect(png.readUInt32BE(20)).toBe(700);
      expect(png.length).toBeGreaterThan(10_000);
    });
  }

  test("uploads image bytes using the bound thread without overriding its destination", async () => {
    const uploadFiles = mock(async () => ({
      fileIds: ["F-chart"],
      raw: { ok: true },
    }));
    const request = mock(async () => ({ ok: true, messages: [] }));
    await uploadSlackChart(
      { uploadFiles, request, channelId: "C-chart", threadTs: "1.0" },
      input,
      "session:call"
    );
    expect(request).toHaveBeenCalledWith("conversations.replies", {
      channel: "C-chart",
      ts: "1.0",
      limit: 100,
    });
    expect(uploadFiles).toHaveBeenCalledTimes(1);
    expect(uploadFiles).toHaveBeenCalledWith([
      {
        data: expect.any(Buffer),
        filename: expect.stringMatching(/^notra-chart-[a-f0-9]{64}\.png$/u),
        mimeType: "image/png",
      },
    ]);
  });

  test("rejects invalid output before uploading and propagates Slack failures", async () => {
    const uploadFiles = mock(async () => {
      throw new Error("missing_scope");
    });
    const slack = {
      uploadFiles,
      request: async () => ({ ok: true, messages: [] }),
      channelId: "C-chart",
      threadTs: "1.0",
    };
    await expect(uploadSlackChart(slack, {}, "session:call")).rejects.toThrow();
    expect(uploadFiles).not.toHaveBeenCalled();
    await expect(
      uploadSlackChart(slack, input, "session:call")
    ).rejects.toThrow("missing_scope");
  });

  test("recovers an accepted upload after a lost response, including later history pages", async () => {
    let filename = "";
    const uploadFiles = mock(async (files: Array<{ filename: string }>) => {
      filename = files[0]?.filename ?? "";
      throw new Error("response lost after Slack accepted the file");
    });
    const request = mock(
      async (operation: string, body: { cursor?: string }) => {
        if (operation === "files.info") {
          return { ok: true, file: { name: filename } };
        }
        if (!filename) {
          return { ok: true, messages: [] };
        }
        return body.cursor
          ? { ok: true, messages: [{ files: [{ id: "F-chart" }] }] }
          : {
              ok: true,
              messages: [],
              response_metadata: { next_cursor: "page-2" },
            };
      }
    );
    const slack = {
      uploadFiles,
      request,
      channelId: "C-chart",
      threadTs: "1.0",
    };
    await expect(
      uploadSlackChart(slack, input, "session:call")
    ).rejects.toThrow("response lost");
    await uploadSlackChart(slack, input, "session:call");
    expect(uploadFiles).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(4);
    await expect(
      uploadSlackChart(slack, input, "session:other-call")
    ).rejects.toThrow("response lost");
    expect(uploadFiles).toHaveBeenCalledTimes(2);
  });

  test("never blindly uploads when history recovery fails", async () => {
    const uploadFiles = mock(async () => ({ fileIds: [], raw: { ok: true } }));
    for (const response of [
      { ok: false, error: "ratelimited" },
      { ok: true },
      { ok: true, messages: [{ files: [{}] }] },
      { ok: true, messages: [{ files: [{ id: "F-inaccessible" }] }] },
      {
        ok: true,
        messages: [],
        response_metadata: { next_cursor: "repeated" },
      },
    ]) {
      await expect(
        uploadSlackChart(
          {
            uploadFiles,
            request: async () => response,
            channelId: "C-chart",
            threadTs: "1.0",
          },
          input,
          "session:call"
        )
      ).rejects.toThrow();
    }
    expect(uploadFiles).not.toHaveBeenCalled();
  });
});
