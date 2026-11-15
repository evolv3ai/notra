import {
  ogImageInputSchema,
  ogImageResultSchema,
} from "@notra/ai/schemas/og-image";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import type {
  OgImageToolConfig,
  OgImageResult,
} from "@notra/ai/types/og-image";
import { uploadGeneratedImageAsset } from "@notra/ai/utils/image-assets";
import { trackImageGenerationUsage } from "@notra/ai/utils/image-post-service";
import { generateBrandOgImage } from "@notra/ai/utils/og-image";
import { logError } from "@notra/ai/utils/server-log";
import { tool } from "ai";
import { z } from "zod";

export function createGenerateOgImageTool(config: OgImageToolConfig) {
  return tool({
    description:
      "Generate a 1200x630 on-brand Open Graph / blog hero PNG for a title. Uses the selected brand identity, autonomously researches and designs its first template, then reuses its saved fonts, logo and layout. No GitHub integration is required. Returns the image URL, template source and any fallback warnings. Pass brandIdentityId from listBrandIdentities, or omit for the active/default brand.",
    inputSchema: config.brandIdentityId
      ? ogImageInputSchema.extend({
          brandIdentityId: z.literal(config.brandIdentityId).optional(),
        })
      : ogImageInputSchema,
    outputSchema: ogImageResultSchema,
    execute: async ({ title, brandIdentityId }, { abortSignal }) => {
      if (
        config.brandIdentityId &&
        brandIdentityId &&
        config.brandIdentityId !== brandIdentityId
      ) {
        throw new Error("Use the active brand identity for this image");
      }
      const usages: AgentTokenUsage[] = [];
      const postId = crypto.randomUUID();
      let output: OgImageResult | undefined;
      let originalError: unknown;
      try {
        const result = await generateBrandOgImage({
          ...config,
          signal: abortSignal,
          title,
          brandIdentityId: config.brandIdentityId ?? brandIdentityId,
          onUsage: config.onUsage ?? ((usage) => usages.push(usage)),
        });
        const imageUrl = await uploadGeneratedImageAsset({
          organizationId: config.organizationId,
          postId,
          pngBase64: result.pngBase64,
        });
        output = {
          imageUrl,
          title,
          brandIdentityId: result.brandIdentityId,
          width: 1200 as const,
          height: 630 as const,
          templateSource: result.templateSource,
          warnings: result.warnings,
        };
      } catch (error) {
        originalError = error;
      }
      const results = await Promise.allSettled(
        usages.map((usage) =>
          trackImageGenerationUsage({
            organizationId: config.organizationId,
            postId,
            usage,
            useMarkup: config.useMarkup,
            chargeAiCredits: config.chargeAiCredits,
          })
        )
      );
      const errors = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);
      for (const error of errors) {
        logError("[og-image] Usage billing failed", error, {
          postId,
          organizationId: config.organizationId,
        });
      }
      if (!output) {
        throw originalError;
      }
      if (errors.length) {
        throw new AggregateError(errors, "OG usage billing incomplete");
      }
      return output;
    },
  });
}
