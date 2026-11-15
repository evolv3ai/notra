import { and, eq, sql } from "drizzle-orm";

import { POST_HISTORY_CONTENT_TYPES } from "../constants/post-history";
import { posts } from "../schema";
import type {
  PostHistoryCheckpointInput,
  PostHistoryCheckpointResult,
  PostHistoryContext,
  PostHistoryErrorCode,
  PostHistoryScope,
  PostHistoryTransaction,
} from "../types/post-history";

export class PostHistoryError extends Error {
  readonly code: PostHistoryErrorCode;
  readonly currentRevision: number | undefined;

  constructor(
    code: PostHistoryErrorCode,
    message: string,
    currentRevision?: number
  ) {
    super(message);
    this.name = "PostHistoryError";
    this.code = code;
    this.currentRevision = currentRevision;
  }
}

export function supportsPostHistory(
  contentType: string
): contentType is (typeof POST_HISTORY_CONTENT_TYPES)[number] {
  return (POST_HISTORY_CONTENT_TYPES as readonly string[]).includes(
    contentType
  );
}

export async function setPostHistoryContext(
  tx: PostHistoryTransaction,
  context: PostHistoryContext
): Promise<void> {
  await tx.execute(sql`SELECT
    set_config('notra.history_actor', ${context.actorUserId ?? ""}, true),
    set_config('notra.history_source', ${context.source}, true)`);
}

export async function prunePostHistory(
  tx: PostHistoryTransaction,
  scope: PostHistoryScope
): Promise<number> {
  const result = await tx.execute<{ deleted: number }>(sql`SELECT
    notra_prune_post_history(${scope.organizationId}, ${scope.postId}) AS deleted`);
  const row = result.rows[0];
  if (!row) {
    throw new Error("History pruning returned no result");
  }
  return row.deleted;
}

export async function checkpointPostHistory(
  tx: PostHistoryTransaction,
  input: PostHistoryCheckpointInput
): Promise<PostHistoryCheckpointResult> {
  const [document] = await tx
    .select({
      revision: posts.revision,
      contentType: posts.contentType,
    })
    .from(posts)
    .where(
      and(
        eq(posts.organizationId, input.organizationId),
        eq(posts.id, input.postId)
      )
    )
    .for("update");
  if (!document) {
    throw new PostHistoryError("NOT_FOUND", "Content not found");
  }
  if (!supportsPostHistory(document.contentType)) {
    throw new PostHistoryError(
      "BAD_REQUEST",
      "History is only available for long-form content"
    );
  }
  if (document.revision !== input.expectedRevision) {
    throw new PostHistoryError(
      "CONFLICT",
      "Content changed since it was loaded",
      document.revision
    );
  }
  const result = await tx.execute<{ id: string }>(sql`SELECT
    notra_capture_post_version(posts, ${input.source}, ${input.actorUserId}) AS id
    FROM posts WHERE organization_id = ${input.organizationId} AND id = ${input.postId}`);
  await prunePostHistory(tx, input);
  const row = result.rows[0];
  if (!row?.id) {
    throw new Error("History checkpoint returned no version");
  }
  return { id: row.id, revision: document.revision };
}
