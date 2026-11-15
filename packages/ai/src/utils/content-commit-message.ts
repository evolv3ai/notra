import { UTILITY_MODEL_ID } from "@notra/ai/constants/models";
import { gateway } from "@notra/ai/gateway";
import { withRouterDefaults } from "@notra/ai/provider-options";
import { buildTelemetryOptions } from "@notra/ai/utils/tcc";
import { generateText, Output } from "ai";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

const CONTENT_COMMIT_HEADLINE_MAX_LENGTH = 72;
const CONTENT_COMMIT_EXCERPT_LENGTH = 1200;
const CONTENT_COMMIT_TIMEOUT_MS = 6000;
const CONVENTIONAL_PREFIX =
  /^(docs|feat|fix|chore|refactor|style|perf)(\([^)]+\))?: /i;

const headlineSchema = z.object({
  headline: z
    .string()
    .trim()
    .min(3)
    .max(CONTENT_COMMIT_HEADLINE_MAX_LENGTH)
    .describe(
      "One conventional-commit headline for this content edit. Prefer docs:. No quotes, no body, no trailing punctuation."
    ),
});

export function fallbackContentCommitHeadline(
  title: string,
  followUp: boolean
) {
  const prefix = followUp ? "docs: update" : "docs: add";
  const collapsed = title.replaceAll(/\s+/g, " ").trim();
  return `${prefix} ${collapsed}`
    .slice(0, CONTENT_COMMIT_HEADLINE_MAX_LENGTH)
    .trim();
}

function sanitizeContentCommitHeadline(
  raw: string | null | undefined,
  fallback: string,
  type = "docs"
) {
  const line = raw?.split(/\r?\n/, 1)[0] ?? "";
  const cleaned = line
    .replaceAll(/[\u2013\u2014]/g, "-")
    .replaceAll(/^["'`]+|["'`]+$/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) {
    return fallback;
  }
  const withType = CONVENTIONAL_PREFIX.test(cleaned)
    ? cleaned
    : `${type}: ${cleaned}`;
  const headline = withType.slice(0, CONTENT_COMMIT_HEADLINE_MAX_LENGTH).trim();
  return headline.length < 8 ? fallback : headline;
}

function excerpt(markdown: string | null | undefined) {
  return (markdown ?? "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, CONTENT_COMMIT_EXCERPT_LENGTH);
}

export async function generateContentCommitHeadline(params: {
  organizationId: string;
  title: string;
  previousMarkdown?: string | null;
  nextMarkdown: string;
  fallback: string;
}): Promise<string> {
  if (
    params.previousMarkdown != null &&
    params.previousMarkdown === params.nextMarkdown
  ) {
    return params.fallback;
  }

  try {
    const { output } = await generateText({
      model: gateway(UTILITY_MODEL_ID, {
        organizationId: params.organizationId,
      }),
      output: Output.object({ schema: headlineSchema }),
      instructions: [
        "You write GitHub commit headlines for edits to a published Notra content file.",
        `At most ${CONTENT_COMMIT_HEADLINE_MAX_LENGTH} characters, one line, conventional commits, prefer docs:.`,
        "Describe the actual edit, not that the file was saved. No quotes, no body, no trailing punctuation.",
      ].join(" "),
      prompt: [
        `Title: ${params.title}`,
        params.previousMarkdown
          ? `Previous:\n${excerpt(params.previousMarkdown)}`
          : null,
        `Updated:\n${excerpt(params.nextMarkdown)}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      providerOptions: withRouterDefaults(
        {
          gateway: { tags: ["content-commit-message"] },
          openai: { reasoningEffort: "none" },
        },
        {
          modelId: UTILITY_MODEL_ID,
        }
      ),
      abortSignal: AbortSignal.timeout(CONTENT_COMMIT_TIMEOUT_MS),
      ...buildTelemetryOptions({
        feature: "content_commit_message",
        organizationId: params.organizationId,
      }),
    });
    return sanitizeContentCommitHeadline(output.headline, params.fallback);
  } catch {
    return params.fallback;
  }
}

export async function generateSiteCommitHeadline(params: {
  organizationId: string;
  changes: readonly {
    path: string;
    deleted: boolean;
    previous?: string | null;
    next?: string | null;
  }[];
  fallback: string;
}): Promise<string> {
  const excerptLength = Math.floor(
    CONTENT_COMMIT_EXCERPT_LENGTH / Math.max(1, params.changes.length)
  );
  const describe = (change: (typeof params.changes)[number]) =>
    [
      `File: ${change.path}${change.deleted ? " (deleted)" : ""}`,
      change.previous
        ? `Previous:\n${excerpt(change.previous).slice(0, excerptLength)}`
        : null,
      change.next
        ? `Updated:\n${excerpt(change.next).slice(0, excerptLength)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

  try {
    const { output } = await generateText({
      model: gateway(UTILITY_MODEL_ID, {
        organizationId: params.organizationId,
      }),
      output: Output.object({ schema: headlineSchema }),
      instructions: [
        "You write GitHub commit headlines for edits to a Notra site repository: blog posts, changelog entries, and the site config.",
        `At most ${CONTENT_COMMIT_HEADLINE_MAX_LENGTH} characters, one line, conventional commits. Use docs: for posts and style: for design or theme changes.`,
        "Describe the actual edit, not that files were saved. No quotes, no body, no trailing punctuation.",
      ].join(" "),
      prompt: params.changes.map(describe).join("\n\n"),
      providerOptions: withRouterDefaults(
        {
          gateway: { tags: ["site-commit-message"] },
          openai: { reasoningEffort: "none" },
        },
        {
          modelId: UTILITY_MODEL_ID,
        }
      ),
      abortSignal: AbortSignal.timeout(CONTENT_COMMIT_TIMEOUT_MS),
      ...buildTelemetryOptions({
        feature: "site_commit_message",
        organizationId: params.organizationId,
      }),
    });
    return sanitizeContentCommitHeadline(
      output.headline,
      params.fallback,
      "chore"
    );
  } catch {
    return params.fallback;
  }
}
