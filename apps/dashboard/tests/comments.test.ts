import { describe, expect, test } from "bun:test";

import { createCommentSchema } from "@/schemas/comments";
import type { DiscussionComment } from "@/types/comments";
import { assertCommentAuthor } from "@/utils/comment-permissions";
import { commentSubmitId } from "@/utils/comment-submit-id";
import {
  getContentCommentReplyParent,
  getContentCommentThreadEntries,
} from "@/utils/content-comment-thread";

describe("discussion boundaries", () => {
  test("content roots require an anchor but replies and other discussion targets do not", () => {
    const input = {
      id: "11111111-1111-4111-8111-111111111111",
      organizationId: "org",
      targetId: "post",
      targetType: "content",
      parentId: null,
      body: "Note",
    };
    const anchor = {
      exact: "text",
      prefix: "",
      suffix: "",
      start: 0,
      end: 4,
      revision: 1,
    };
    expect(createCommentSchema.safeParse(input).success).toBe(false);
    expect(createCommentSchema.safeParse({ ...input, anchor }).success).toBe(
      true
    );
    expect(
      createCommentSchema.safeParse({ ...input, parentId: "root" }).success
    ).toBe(true);
    expect(
      createCommentSchema.safeParse({ ...input, parentId: "root", anchor })
        .success
    ).toBe(false);
    for (const targetType of ["feedback", "shelf"]) {
      expect(
        createCommentSchema.safeParse({ ...input, targetType }).success
      ).toBe(true);
    }
  });
  test("only the author can edit or delete, including after account deletion", () => {
    expect(() => assertCommentAuthor("author", "author")).not.toThrow();
    expect(() => assertCommentAuthor("author", "another-member")).toThrow();
    expect(() => assertCommentAuthor(null, "another-member")).toThrow();
  });
  test("retries reuse the original client id for the same body and parent", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const retry = { id, body: "hello", parentId: null };
    expect(commentSubmitId(retry, "hello", null)).toBe(id);
    expect(commentSubmitId({ ...retry, parentId: "p" }, "hello", "p")).toBe(id);
    expect(commentSubmitId(retry, "other", null)).not.toBe(id);
    expect(commentSubmitId(null, "hello", null)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
  test("inline replies stay in their thread and attach to the deepest live ancestor below the depth limit", () => {
    const root: DiscussionComment = {
      id: "root",
      parentId: null,
      depth: 0,
      userId: "author",
      body: "Root comment",
      createdAt: "2026-10-15T00:00:00Z",
      editedAt: null,
      deletedAt: null,
      name: "Author",
      image: null,
      reactions: [],
    };
    const deleted = { ...root, deletedAt: root.createdAt };
    const child = { ...root, id: "child", parentId: root.id, depth: 1 };
    const nested = { ...child, id: "nested", parentId: child.id, depth: 2 };
    const limit = { ...nested, id: "limit", depth: 5 };
    const unrelated = { ...root, id: "unrelated" };
    const orphan = { ...child, id: "orphan", parentId: "missing" };
    const cycle = { ...child, id: "cycle", parentId: "cycle" };
    const entries = getContentCommentThreadEntries(
      [deleted, child, unrelated, nested, limit, orphan, cycle],
      root.id
    );

    expect(entries).toEqual([deleted, child, nested, limit]);
    expect(getContentCommentReplyParent(entries, child.id)).toBe(child);
    for (const selectedId of [
      undefined,
      root.id,
      nested.id,
      limit.id,
      unrelated.id,
      "gone",
    ]) {
      expect(getContentCommentReplyParent(entries, selectedId)).toBe(child);
    }
    expect(
      getContentCommentReplyParent([deleted, limit], root.id)
    ).toBeUndefined();
    expect(getContentCommentReplyParent([], undefined)).toBeUndefined();
  });
});
