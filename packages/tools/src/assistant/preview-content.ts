import { getBaseUrl } from "@notra/ai/qstash/triggers";
import {
  contentPreviewRequestSchema,
  contentPreviewResultSchema,
  contentPreviewToolInputSchema,
} from "@notra/ai/schemas/content-preview";
import { defineTool } from "eve/tools";

import { requireOrganizationId } from "../utils/organization";

export function createPreviewContentTool() {
  return defineTool({
    description:
      "Preview a saved blog post or changelog on a Notra hosted site without changing GitHub or publishing live. Use list_sites with the saved postId to discover compatible active sites, including sites not yet live. Ask which site if several match. Use deploy with the selected siteId to build the latest saved draft; this replaces that post's previous preview. Defaults to a one-day link. An omitted password preserves existing protection; a new preview without a password is accessible to anyone with the link, so only deploy when the user requests a preview. Use status to check the asynchronous build without rebuilding. Only report ready when status is ready, live is true and deleting is false; otherwise report pending, failure or expiry honestly. Never use this to bypass a failed public-site read. No live publication or PR is created.",
    inputSchema: contentPreviewToolInputSchema,
    async execute(input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      const baseUrl = getBaseUrl();
      const secret = process.env.INTERNAL_WORKFLOW_SECRET?.trim();
      if (!(baseUrl && secret)) {
        throw new Error("Content previews are not configured");
      }
      const response = await fetch(`${baseUrl}/api/internal/content/preview`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(
          contentPreviewRequestSchema.parse({ ...input, organizationId })
        ),
        signal: AbortSignal.timeout(120_000),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : `Content preview failed (${response.status})`;
        throw new Error(message);
      }
      return contentPreviewResultSchema.parse(result);
    },
  });
}
