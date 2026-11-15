// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

export const routingDecisionSchema = z.object({
  complexity: z
    .enum(["simple", "complex"])
    .describe(
      "Whether the task is simple (greeting, quick question, single-turn) or complex (multi-step, content creation, research)"
    ),
  requiresTools: z
    .boolean()
    .describe(
      "Whether the task requires using tools like editing markdown, fetching GitHub data, or using skills"
    ),
  reasoningHeavy: z
    .boolean()
    .describe(
      "Whether the task requires deep reasoning, multi-step analysis, research, or long-form synthesis (true) vs. everyday chat/edits (false)"
    ),
  reasoning: z
    .string()
    .describe("Brief 1-2 sentence explanation of the routing decision"),
});
