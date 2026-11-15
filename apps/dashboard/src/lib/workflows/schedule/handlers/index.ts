import { ContentGenerationSkippedError } from "@notra/ai/agents/background-gen";
import { generateBlogPost } from "@notra/ai/agents/blog-post";
import { generateChangelog } from "@notra/ai/agents/changelog";
import { generateLinkedInPost } from "@notra/ai/agents/linkedin";
import { generateTwitterPost } from "@notra/ai/agents/twitter";
import { isGitHubRateLimitError } from "@notra/ai/tools/github";
import { logInfo } from "@notra/ai/utils/server-log";
import type { ScheduleOutputType } from "@notra/schemas/dashboard/integrations";

import { AGENT_CONTENT_TASK_TYPES } from "@/constants/agent-content";
import { generateContentViaAgentTask } from "@/lib/agent/content-task";
import { isAgentContentGenerationEnabled } from "@/lib/agent/flag";

import type {
  ContentGenerationContext,
  ContentGenerationResult,
  ContentHandler,
} from "../types";
import { handleImage } from "./image";

function createTextPostHandler(
  generate: typeof generateChangelog
): ContentHandler {
  return async (ctx) => {
    try {
      const { postId, title, posts, usage } = await generate({
        organizationId: ctx.organizationId,
        collectionId: ctx.collectionId,
        voiceId: ctx.voiceId,
        repositories: ctx.repositories,
        linearIntegrations: ctx.linearIntegrations,
        tone: ctx.tone,
        promptInput: ctx.promptInput,
        sourceMetadata: ctx.sourceMetadata,
        dataPointSettings: ctx.dataPointSettings,
        selectionFilters: ctx.selectionFilters,
        commitWindow: ctx.commitWindow,
        autoPublish: ctx.autoPublish,
        resolveContext: ctx.resolveContext,
        resolveLinearContext: ctx.resolveLinearContext,
        log: ctx.log,
        telemetryMetadata: ctx.telemetryMetadata,
      });

      return { status: "ok", postId, title, posts, usage };
    } catch (error) {
      if (error instanceof ContentGenerationSkippedError) {
        return { status: "skipped", reason: error.message };
      }

      if (isGitHubRateLimitError(error)) {
        return {
          status: "rate_limited",
          retryAfterSeconds: error.retryAfterSeconds,
        };
      }

      return {
        status: "generation_failed",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

const handlers: Record<ScheduleOutputType, ContentHandler> = {
  changelog: createTextPostHandler(generateChangelog),
  blog_post: createTextPostHandler(generateBlogPost),
  linkedin_post: createTextPostHandler(generateLinkedInPost),
  twitter_post: createTextPostHandler(generateTwitterPost),
  image: handleImage,
};

export async function generateScheduledContent(
  outputType: string,
  ctx: ContentGenerationContext
): Promise<ContentGenerationResult> {
  if (isAgentContentGenerationEnabled() && isScheduleOutputType(outputType)) {
    const taskType = AGENT_CONTENT_TASK_TYPES[outputType];
    if (taskType) {
      return generateContentViaAgentTask({
        organizationId: ctx.organizationId,
        collectionId: ctx.collectionId,
        contentType: taskType.contentType,
        contentLabel: taskType.contentLabel,
        brandAgentType: taskType.brandAgentType,
        repositories: ctx.repositories,
        linearIntegrations: ctx.linearIntegrations,
        promptInput: ctx.promptInput,
        sourceMetadata: ctx.sourceMetadata,
        dataPointSettings: ctx.dataPointSettings,
        selectionFilters: ctx.selectionFilters,
        commitWindow: ctx.commitWindow,
        autoPublish: ctx.autoPublish,
        voiceId: ctx.voiceId,
        chargeAiCredits: ctx.chargeAiCredits,
      });
    }
  }

  const handler = isScheduleOutputType(outputType)
    ? handlers[outputType]
    : null;

  if (!handler) {
    logInfo("[Schedule] Output type not fully implemented yet", {
      outputType,
    });
    return {
      status: "unsupported_output_type",
      outputType,
    };
  }

  return handler(ctx);
}

function isScheduleOutputType(value: string): value is ScheduleOutputType {
  return value in handlers;
}
