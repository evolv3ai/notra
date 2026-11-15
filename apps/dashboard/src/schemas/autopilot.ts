import * as z from "zod";

import { AUTOPILOT_RULE_MAX_CHARS } from "@/constants/autopilot";

export const blogFileSchema = z.object({
  slug: z.string().describe("kebab-case file slug without extension"),
  extension: z.enum(["md", "mdx"]),
  title: z.string(),
  content: z
    .string()
    .describe(
      "The complete file including frontmatter in the repository's existing format"
    ),
  pullRequestBody: z
    .string()
    .describe(
      "Concise Markdown PR description: one sentence on the reader benefit, then at most three short bullets about what the post covers. Omit word counts, frontmatter details, lists of internal URLs, headings, and attribution; Notra adds its own branded footer."
    ),
});

export const readinessAgentOutputSchema = z.object({
  framework: z
    .string()
    .describe(
      "Detected site framework, e.g. Next.js App Router, Astro, static HTML"
    ),
  pullRequestTitle: z.string(),
  pullRequestBody: z.string().describe("Markdown body explaining each change"),
});

export const ruleSchema = z.object({
  rule: z
    .string()
    .max(AUTOPILOT_RULE_MAX_CHARS)
    .nullable()
    .describe(
      "One short imperative rule starting with 'Never', or null when the message only declines this one item"
    ),
});

export const autopilotFeedbackSchema = z.object({
  reply: z.string().max(700),
  learning: z.string().max(1000).nullable(),
  rule: z.string().max(AUTOPILOT_RULE_MAX_CHARS).nullable(),
  removeRuleId: z.string().nullable(),
});

export const autopilotRuleComplianceSchema = z.object({ allowed: z.boolean() });
