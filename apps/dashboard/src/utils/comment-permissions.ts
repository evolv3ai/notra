import { COMMENT_MAX_DEPTH } from "@/constants/comments";
import { badRequest, forbidden } from "@/lib/orpc/utils/errors";
import type { CommentResolutionState } from "@/types/comments";

export function replyDepth(
  parent: { depth: number; deletedAt: Date | null } | null,
  rejectedMessage = "Replies are limited to three levels and cannot target deleted comments"
) {
  if (!parent) {
    return 0;
  }
  if (parent.depth >= COMMENT_MAX_DEPTH || parent.deletedAt) {
    throw badRequest(rejectedMessage);
  }
  return parent.depth + 1;
}

export function assertCommentAuthor(
  authorId: string | null,
  userId: string,
  rejectedMessage = "You can only change your own comments"
) {
  if (authorId !== userId) {
    throw forbidden(rejectedMessage);
  }
}

export function assertResolvableComment(comment: CommentResolutionState) {
  if (comment.parentId || comment.deletedAt) {
    throw badRequest("Only active content root threads can be resolved");
  }
}
