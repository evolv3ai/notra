import { commentTargetSchema } from "@/schemas/comments";
import type { CommentTarget } from "@/types/comments";

export function commentChannel(target: CommentTarget) {
  return `discussion:${encodeURIComponent(target.organizationId)}:${target.targetType}:${encodeURIComponent(target.targetId)}`;
}

export function parseDiscussionChannel(channel: string): CommentTarget | null {
  const match =
    /^discussion:([^:*?\s]+):(feedback|shelf|content):([^:*?\s]+)$/.exec(
      channel
    );
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  try {
    const parsed = commentTargetSchema.safeParse({
      organizationId: decodeURIComponent(match[1]),
      targetType: match[2],
      targetId: decodeURIComponent(match[3]),
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
