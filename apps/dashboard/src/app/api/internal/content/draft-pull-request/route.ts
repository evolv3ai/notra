import {
  createContentPullRequestRequestSchema,
  createContentPullRequestResultSchema,
} from "@notra/ai/schemas/content-pull-request";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { posts } from "@notra/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { assertActiveSubscription } from "@/lib/billing/subscription";
import { publishSavedContentToGitHub } from "@/lib/integrations/github/publish-saved-content";
import { assertNotDemo } from "@/lib/orpc/utils/errors";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";
import { ratelimit } from "@/utils/ratelimit";

export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = createContentPullRequestRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { organizationId, postId, integrationId } = parsed.data;
  try {
    assertNotDemo();
    await assertActiveSubscription(organizationId);
    if (
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      const { success } = await ratelimit.githubPublish.limit(
        `agent:${organizationId}`
      );
      if (!success) {
        return Response.json(
          { error: "Too many GitHub publish requests" },
          { status: 429 }
        );
      }
    }
    const post = await db.query.posts.findFirst({
      where: and(
        eq(posts.id, postId),
        eq(posts.organizationId, organizationId)
      ),
      columns: { contentType: true },
    });
    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.contentType !== "blog_post" && post.contentType !== "changelog") {
      return Response.json(
        { error: "Only blog posts and changelogs can be exported to GitHub" },
        { status: 400 }
      );
    }
    // Agent output always goes through review, even on direct-publish repositories.
    const result = await publishSavedContentToGitHub(
      {
        organizationId,
        contentId: postId,
        contentType: post.contentType,
        repositoryId: integrationId,
      },
      { requirePullRequest: true }
    );
    return Response.json(createContentPullRequestResultSchema.parse(result));
  } catch (error) {
    if (error instanceof ORPCError && error.status < 500) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    logError("Failed to create content draft pull request", error, {
      organizationId,
      postId,
    });
    return Response.json(
      {
        error:
          "Failed to prepare the GitHub draft pull request. Retry with the same post and repository to recover an existing PR.",
      },
      { status: 502 }
    );
  }
}
