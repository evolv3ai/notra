import { COMMENT_MAX_DEPTH } from "@/constants/comments";
import type { DiscussionComment } from "@/types/comments";

export function getContentCommentThreadEntries(
  items: DiscussionComment[],
  threadId: string
) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return items.filter((item) => {
    const seen = new Set<string>();
    let current: DiscussionComment | undefined = item;
    while (current && !seen.has(current.id)) {
      if (current.id === threadId) {
        return true;
      }
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  });
}

/** Replies to comments at the depth limit attach to the deepest ancestor that still accepts replies. */
export function getContentCommentReplyParent(
  entries: DiscussionComment[],
  selectedId: string | undefined
) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  let parent = selectedId ? byId.get(selectedId) : undefined;
  while (parent && (parent.deletedAt || parent.depth >= COMMENT_MAX_DEPTH)) {
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return (
    parent ??
    entries.find((entry) => !entry.deletedAt && entry.depth < COMMENT_MAX_DEPTH)
  );
}
