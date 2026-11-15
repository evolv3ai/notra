import { z } from "zod";

import {
  COMMENT_ANCHOR_CONTEXT_LENGTH,
  COMMENT_ANCHOR_LONE_SURROGATE_REGEX,
  COMMENT_ANCHOR_MAX_EXACT_LENGTH,
} from "@/constants/comments";

export const commentTargetSchema = z.object({
  organizationId: z.string().min(1),
  targetId: z.string().min(1),
  targetType: z.enum(["feedback", "shelf", "content"]),
});
const commentAnchorSchema = z
  .strictObject({
    exact: z.string().min(1).max(COMMENT_ANCHOR_MAX_EXACT_LENGTH),
    prefix: z.string().max(COMMENT_ANCHOR_CONTEXT_LENGTH),
    suffix: z.string().max(COMMENT_ANCHOR_CONTEXT_LENGTH),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative().max(2147483647),
  })
  .refine((anchor) => anchor.end - anchor.start === anchor.exact.length, {
    message: "Anchor offsets must match the quoted text",
  })
  .refine((anchor) => anchor.prefix.length <= anchor.start, {
    message: "Anchor context must fit before the quoted text",
  })
  .refine(
    (anchor) =>
      [anchor.exact, anchor.prefix, anchor.suffix].every(
        (part) => !COMMENT_ANCHOR_LONE_SURROGATE_REGEX.test(part)
      ),
    { message: "Anchor text must be well-formed" }
  );
export const createCommentSchema = commentTargetSchema
  .extend({
    id: z.uuid(),
    parentId: z.string().min(1).nullable(),
    body: z.string().trim().min(1).max(10000),
    anchor: commentAnchorSchema.optional(),
  })
  .refine(
    (input) =>
      !input.anchor || (input.targetType === "content" && !input.parentId),
    { message: "Only content threads can be anchored", path: ["anchor"] }
  )
  .refine(
    (input) =>
      input.targetType !== "content" ||
      input.parentId !== null ||
      Boolean(input.anchor),
    { message: "Content threads require a text anchor", path: ["anchor"] }
  );
export const changeCommentSchema = commentTargetSchema.extend({
  commentId: z.string().min(1),
  body: z.string().trim().min(1).max(10000).optional(),
});
export const reactCommentSchema = changeCommentSchema.extend({
  emoji: z.enum(["❤️", "🔥", "👍", "👎", "👀", "👑"]),
  active: z.boolean(),
});
export const resolveCommentSchema = commentTargetSchema.extend({
  targetType: z.literal("content"),
  commentId: z.string().min(1),
  resolved: z.boolean(),
});
