import { createHash } from "node:crypto";

import type { SlackHandle } from "eve/channels/slack";

import {
  chartFileInfoSchema,
  chartInputSchema,
  chartThreadPageSchema,
} from "../schemas/chart";
import { renderChart } from "./render-chart";

export async function uploadSlackChart(
  slack: Pick<
    SlackHandle,
    "uploadFiles" | "request" | "channelId" | "threadTs"
  >,
  output: unknown,
  deliveryKey: string
): Promise<void> {
  const chart = chartInputSchema.parse(output);
  if (!slack.channelId || !slack.threadTs) {
    throw new Error("Chart delivery requires a Slack thread");
  }
  const filename = `notra-chart-${createHash("sha256")
    .update(JSON.stringify([deliveryKey, chart]))
    .digest("hex")}.png`;
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (;;) {
    const response = await slack.request("conversations.replies", {
      channel: slack.channelId,
      ts: slack.threadTs,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    const page = chartThreadPageSchema.safeParse(response);
    if (!page.success) {
      throw new Error("Could not recover prior Slack chart delivery");
    }
    for (const message of page.data.messages) {
      for (const file of message.files ?? []) {
        let name = file.name;
        if (!name) {
          if (!file.id) {
            throw new Error(
              "Slack chart recovery received an unidentified file"
            );
          }
          const info = chartFileInfoSchema.safeParse(
            await slack.request("files.info", { file: file.id })
          );
          if (!info.success) {
            throw new Error(
              "Slack chart recovery could not identify a shared file"
            );
          }
          name = info.data.file.name;
        }
        if (name === filename) {
          return;
        }
      }
    }
    const next = page.data.response_metadata?.next_cursor;
    if (!next) {
      break;
    }
    if (seen.has(next)) {
      throw new Error("Slack chart recovery returned a repeated cursor");
    }
    seen.add(next);
    cursor = next;
  }
  await slack.uploadFiles([
    {
      data: await renderChart(chart),
      filename,
      mimeType: "image/png",
    },
  ]);
}
