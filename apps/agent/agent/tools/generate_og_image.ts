import {
  ogImageInputSchema,
  ogImageResultSchema,
} from "@notra/ai/schemas/og-image";
import { requireOrganizationId } from "@notra/tools/utils/organization";
import {
  getBooleanSessionAttribute,
  getSessionAttribute,
} from "@notra/tools/utils/session";
import { defineTool } from "eve/tools";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description:
      "Generate a 1200x630 on-brand Open Graph or blog hero PNG for an exact title. No GitHub repository is required. Reuses the brand's saved template after the first design. Discover brandIdentityId with list_brand_identities, or omit it for the default brand. Return imageUrl and disclose fallback warnings. Creates an image asset, not a content post; does not publish or attach it to a post.",
    inputSchema: ogImageInputSchema,
    outputSchema: ogImageResultSchema,
    async execute(input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      const { createGenerateOgImageTool } =
        await import("@notra/ai/tools/og-image");
      const tool = createGenerateOgImageTool({
        organizationId,
        useMarkup: getBooleanSessionAttribute(ctx, "useMarkup"),
        chargeAiCredits:
          getSessionAttribute(ctx, "chargeAiCredits") !== "false",
      });
      if (!tool.execute) {
        throw new Error("OG image generation is unavailable");
      }
      return ogImageResultSchema.parse(
        await tool.execute(input, {
          toolCallId: ctx.callId,
          messages: [],
          abortSignal: ctx.abortSignal,
          context: {},
        })
      );
    },
  }),
  "Generating a brand OG image"
);
