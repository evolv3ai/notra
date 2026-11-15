import { ContentGenerationSkippedError } from "@notra/ai/agents/background-gen";
import { generateBlogPost } from "@notra/ai/agents/blog-post";
import { generateChangelog } from "@notra/ai/agents/changelog";
import { generateLinkedInPost } from "@notra/ai/agents/linkedin";
import { generateTwitterPost } from "@notra/ai/agents/twitter";

import { AGENT_CONTENT_TASK_TYPES } from "@/constants/agent-content";
import { generateContentViaAgentTask } from "@/lib/agent/content-task";
import { isAgentContentGenerationEnabled } from "@/lib/agent/flag";
import type {
  EventGenerationContext,
  EventGenerationResult,
} from "@/types/workflows/workflows";

import { buildEventPromptInput } from "../prompt-input";

const generateFnMap: Record<string, typeof generateChangelog> = {
  changelog: generateChangelog,
  blog_post: generateBlogPost,
  twitter_post: generateTwitterPost,
  linkedin_post: generateLinkedInPost,
};

export async function generateEventBasedContent(
  ctx: EventGenerationContext
): Promise<EventGenerationResult> {
  const { outputType } = ctx;

  const generateFn = generateFnMap[outputType];
  if (!generateFn) {
    return {
      status: "unsupported_output_type",
      outputType,
    };
  }

  const repositories = [
    {
      integrationId: ctx.repositoryId,
      owner: ctx.repositoryOwner,
      repo: ctx.repositoryName,
      defaultBranch: null,
    },
  ];

  const agentTaskType = isAgentContentGenerationEnabled()
    ? AGENT_CONTENT_TASK_TYPES[outputType]
    : undefined;
  if (agentTaskType) {
    const agentResult = await generateContentViaAgentTask({
      organizationId: ctx.organizationId,
      collectionId: ctx.collectionId,
      contentType: agentTaskType.contentType,
      contentLabel: agentTaskType.contentLabel,
      brandAgentType: agentTaskType.brandAgentType,
      repositories,
      promptInput: buildEventPromptInput(ctx),
      sourceMetadata: ctx.sourceMetadata,
      autoPublish: ctx.autoPublish,
      chargeAiCredits: ctx.chargeAiCredits,
    });
    if (agentResult.status === "rate_limited") {
      return {
        status: "generation_failed",
        reason: "Agent task was rate limited",
      };
    }
    return agentResult;
  }

  try {
    const { postId, title, posts, usage } = await generateFn({
      organizationId: ctx.organizationId,
      collectionId: ctx.collectionId,
      repositories,
      tone: ctx.tone,
      promptInput: buildEventPromptInput(ctx),
      sourceMetadata: ctx.sourceMetadata,
      autoPublish: ctx.autoPublish,
      resolveContext: ctx.resolveContext,
      telemetryMetadata: ctx.telemetryMetadata,
    });

    return { status: "ok", postId, title, posts, usage };
  } catch (error) {
    if (error instanceof ContentGenerationSkippedError) {
      return {
        status: "skipped",
        reason: error.message,
      };
    }

    return {
      status: "generation_failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
