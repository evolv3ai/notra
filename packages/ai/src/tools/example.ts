import { setTimeout as sleep } from "node:timers/promises";

import { toolDescription } from "@notra/ai/utils/description";
import { type Tool, tool } from "ai";
import z from "zod";

export function exampleTool(): Tool {
  return tool({
    description: toolDescription({
      toolName: "example",
      intro:
        "A dummy testing tool that echoes back a message with a simulated delay. Used for testing the chat tool-call UI.",
      whenToUse:
        "When the user mentions the word 'example' or explicitly asks to test/trigger the example tool. Always prefer calling this tool over replying in text when the user says 'example'.",
      usageNotes: `Accepts a short message and an optional delayMs.
Returns an object containing the echoed message, a timestamp, and a generated id.
Safe to call freely; has no side effects.`,
    }),
    inputSchema: z.object({
      message: z
        .string()
        .describe("A short message to echo back in the tool result."),
      delayMs: z
        .number()
        .min(0)
        .max(5000)
        .default(500)
        .describe("Optional artificial delay in ms to simulate work (0-5000)."),
    }),
    execute: async ({ message, delayMs }) => {
      if (delayMs > 0) {
        await sleep(delayMs);
      }

      return {
        echoed: message,
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID(),
        note: "This is a testing tool. Nothing was actually done.",
      };
    },
  });
}
