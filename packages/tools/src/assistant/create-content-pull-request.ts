import { getBaseUrl } from "@notra/ai/qstash/triggers";
import {
  createContentPullRequestInputSchema,
  createContentPullRequestRequestSchema,
  createContentPullRequestResultSchema,
} from "@notra/ai/schemas/content-pull-request";
import { defineTool } from "eve/tools";

import { requireOrganizationId } from "../utils/organization";

export function createCreateContentPullRequestTool() {
  return defineTool({
    description:
      "Create a GitHub draft pull request from a saved blog post or changelog. Uses the same configured content directory, site metadata, and image handling as the dashboard. Discover the GitHub integrationId first. Save new content with its create tool before calling this. Reuses the matching open content PR on retries instead of creating duplicates. Never merges or publishes to the live site. Return the pullRequestUrl to the user. Draft PR creation does not require approval.",
    inputSchema: createContentPullRequestInputSchema,
    async execute(input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      const baseUrl = getBaseUrl();
      const secret = process.env.INTERNAL_WORKFLOW_SECRET?.trim();
      if (!(baseUrl && secret)) {
        throw new Error("Content pull request creation is not configured");
      }
      const response = await fetch(
        `${baseUrl}/api/internal/content/draft-pull-request`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${secret}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(
            createContentPullRequestRequestSchema.parse({
              ...input,
              organizationId,
            })
          ),
          signal: AbortSignal.timeout(120_000),
        }
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : `Content pull request creation failed (${response.status})`;
        throw new Error(message);
      }
      return createContentPullRequestResultSchema.parse(result);
    },
  });
}
