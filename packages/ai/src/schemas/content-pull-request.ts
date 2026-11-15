import { z } from "zod";

export const createContentPullRequestInputSchema = z.object({
  postId: z
    .string()
    .trim()
    .min(1)
    .describe("The ID of the saved blog post or changelog to export"),
  integrationId: z
    .string()
    .trim()
    .min(1)
    .describe(
      "GitHub integrationId from get_available_integrations. Ask which repository to use when more than one could match."
    ),
});

export const createContentPullRequestRequestSchema =
  createContentPullRequestInputSchema.extend({
    organizationId: z.string().trim().min(1),
  });

export const createContentPullRequestResultSchema = z.object({
  branchName: z.string().min(1),
  operation: z.enum(["created", "updated"]),
  path: z.string().min(1),
  pullRequestNumber: z.number().int().positive(),
  pullRequestUrl: z.url(),
});
