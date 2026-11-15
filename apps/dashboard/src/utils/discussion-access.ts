import { db } from "@notra/db/drizzle";
import { agentFeedback, geoShelfSources, posts } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import { notFound } from "@/lib/orpc/utils/errors";
import type { CommentTarget, CommentTransaction } from "@/types/comments";

export async function assertDiscussionTarget(
  input: CommentTarget,
  transaction?: CommentTransaction
) {
  const table = {
    feedback: agentFeedback,
    shelf: geoShelfSources,
    content: posts,
  }[input.targetType];
  const query = (transaction ?? db)
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        eq(table.id, input.targetId),
        eq(table.organizationId, input.organizationId)
      )
    )
    .limit(1);
  const [target] = transaction ? await query.for("key share") : await query;
  if (!target) {
    throw notFound("Discussion not found");
  }
}
