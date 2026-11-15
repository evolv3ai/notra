import { realtime } from "@notra/ai/realtime";
import { db } from "@notra/db/drizzle";
import {
  discussionComments,
  discussionReactions,
  posts,
  users,
} from "@notra/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { assertOrganizationAccess } from "@/lib/auth/organization";
import { getTranslations } from "@/lib/i18n/server";
import { authorizedProcedure } from "@/lib/orpc/base";
import { badRequest, conflict, notFound } from "@/lib/orpc/utils/errors";
import { publishCommentChange } from "@/lib/realtime/comments";
import {
  commentTargetSchema,
  createCommentSchema,
  changeCommentSchema,
  reactCommentSchema,
  resolveCommentSchema,
} from "@/schemas/comments";
import type { AuthenticatedUser } from "@/types/auth/organization";
import type {
  CommentTarget,
  CommentTransaction,
  CreateCommentInput,
  DiscussionComment,
} from "@/types/comments";
import {
  assertCommentAuthor,
  assertResolvableComment,
  replyDepth,
} from "@/utils/comment-permissions";
import { assertDiscussionTarget } from "@/utils/discussion-access";

function targetWhere(input: CommentTarget) {
  return and(
    eq(discussionComments.organizationId, input.organizationId),
    eq(
      {
        feedback: discussionComments.feedbackId,
        shelf: discussionComments.shelfSourceId,
        content: discussionComments.contentId,
      }[input.targetType],
      input.targetId
    )
  );
}

async function isSameComment(
  tx: CommentTransaction,
  input: CreateCommentInput,
  userId: string
) {
  const [existing] = await tx
    .select()
    .from(discussionComments)
    .where(and(targetWhere(input), eq(discussionComments.id, input.id)))
    .limit(1);
  const { anchor } = input;
  return Boolean(
    existing &&
    existing.userId === userId &&
    existing.parentId === input.parentId &&
    existing.body === input.body &&
    (anchor
      ? existing.anchor &&
        Object.entries(anchor).every(
          ([key, value]) =>
            existing.anchor?.[key as keyof typeof anchor] === value
        )
      : !existing.anchor)
  );
}

async function assertDiscussionAccess(
  context: { headers: Headers; user: AuthenticatedUser },
  input: CommentTarget
) {
  await assertOrganizationAccess({
    headers: context.headers,
    organizationId: input.organizationId,
    user: context.user,
  });
  await assertDiscussionTarget(input);
}

async function findComment(input: CommentTarget & { commentId: string }) {
  const [comment] = await db
    .select()
    .from(discussionComments)
    .where(and(targetWhere(input), eq(discussionComments.id, input.commentId)))
    .limit(1);
  if (!comment) {
    throw notFound("Comment not found");
  }
  return comment;
}

export const commentsRouter = {
  list: authorizedProcedure
    .input(commentTargetSchema)
    .handler(async ({ context, input }) => {
      await assertDiscussionAccess(context, input);
      const rows = await db
        .select({
          comment: discussionComments,
          name: users.name,
          image: users.image,
        })
        .from(discussionComments)
        .leftJoin(users, eq(users.id, discussionComments.userId))
        .where(targetWhere(input))
        .orderBy(asc(discussionComments.createdAt), asc(discussionComments.id));
      const reactions = rows.length
        ? await db
            .select()
            .from(discussionReactions)
            .where(
              inArray(
                discussionReactions.commentId,
                rows.map(({ comment }) => comment.id)
              )
            )
        : [];
      const reactionsByComment = new Map<string, typeof reactions>();
      for (const reaction of reactions) {
        const group = reactionsByComment.get(reaction.commentId);
        if (group) {
          group.push(reaction);
        } else {
          reactionsByComment.set(reaction.commentId, [reaction]);
        }
      }
      const items: DiscussionComment[] = rows.map(
        ({ comment, name, image }) => ({
          ...comment,
          name: name ?? "Former member",
          image,
          createdAt: comment.createdAt.toISOString(),
          editedAt: comment.editedAt?.toISOString() ?? null,
          deletedAt: comment.deletedAt?.toISOString() ?? null,
          resolvedAt: comment.resolvedAt?.toISOString() ?? null,
          reactions: (reactionsByComment.get(comment.id) ?? []).map(
            ({ emoji, userId }) => ({ emoji, userId })
          ),
        })
      );
      return {
        items,
        realtimeEnabled: Boolean(realtime),
        currentUser: {
          id: context.user.id,
          name: context.user.name,
          image: context.user.image ?? null,
        },
      };
    }),
  create: authorizedProcedure
    .input(createCommentSchema)
    .handler(async ({ context, input }) => {
      await assertDiscussionAccess(context, input);
      const rejectedMessage = (await getTranslations("errors.comments"))(
        "replyNotAllowed"
      );
      await db.transaction(async (tx) => {
        if (input.anchor) {
          const [post] = await tx
            .select({ revision: posts.revision })
            .from(posts)
            .where(
              and(
                eq(posts.id, input.targetId),
                eq(posts.organizationId, input.organizationId)
              )
            )
            .limit(1)
            .for("share");
          if (!post) {
            throw notFound("Discussion not found");
          }
          if (post.revision !== input.anchor.revision) {
            if (await isSameComment(tx, input, context.user.id)) {
              return;
            }
            throw conflict(
              (await getTranslations("errors.comments"))("anchorStale")
            );
          }
        } else {
          await assertDiscussionTarget(input, tx);
        }
        const [parent] = input.parentId
          ? await tx
              .select({
                depth: discussionComments.depth,
                deletedAt: discussionComments.deletedAt,
              })
              .from(discussionComments)
              .where(
                and(
                  targetWhere(input),
                  eq(discussionComments.id, input.parentId)
                )
              )
              .limit(1)
              .for("update")
          : [null];
        if (input.parentId && !parent) {
          throw notFound("Comment not found");
        }
        const depth = replyDepth(parent ?? null, rejectedMessage);
        const [created] = await tx
          .insert(discussionComments)
          .values({
            id: input.id,
            organizationId: input.organizationId,
            feedbackId: input.targetType === "feedback" ? input.targetId : null,
            shelfSourceId: input.targetType === "shelf" ? input.targetId : null,
            contentId: input.targetType === "content" ? input.targetId : null,
            parentId: input.parentId,
            depth,
            userId: context.user.id,
            body: input.body,
            anchor: input.anchor ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: discussionComments.id });
        if (
          !created &&
          input.anchor &&
          !(await isSameComment(tx, input, context.user.id))
        ) {
          throw conflict("Comment id is already in use");
        }
      });
      await publishCommentChange(input);
      return { id: input.id };
    }),
  resolve: authorizedProcedure
    .input(resolveCommentSchema)
    .handler(async ({ context, input }) => {
      await assertDiscussionAccess(context, input);
      const comment = await findComment(input);
      assertResolvableComment(comment);
      const [updated] = await db
        .update(discussionComments)
        .set({
          resolvedAt: input.resolved ? new Date() : null,
          resolvedByUserId: input.resolved ? context.user.id : null,
        })
        .where(
          and(
            targetWhere(input),
            eq(discussionComments.id, comment.id),
            isNull(discussionComments.parentId),
            isNull(discussionComments.deletedAt)
          )
        )
        .returning({ id: discussionComments.id });
      if (!updated) {
        throw badRequest("Only active content root threads can be resolved");
      }
      await publishCommentChange(input);
      return { success: true };
    }),
  edit: authorizedProcedure
    .input(changeCommentSchema)
    .handler(async ({ context, input }) => {
      await assertDiscussionAccess(context, input);
      const comment = await findComment(input);
      assertCommentAuthor(
        comment.userId,
        context.user.id,
        (await getTranslations("errors.comments"))("notAuthor")
      );
      if (!input.body || comment.deletedAt) {
        const tErrors = await getTranslations("errors.comments");
        throw badRequest(tErrors("notEditable"));
      }
      await db
        .update(discussionComments)
        .set({ body: input.body, editedAt: new Date() })
        .where(
          and(
            eq(discussionComments.id, comment.id),
            isNull(discussionComments.deletedAt)
          )
        );
      await publishCommentChange(input);
      return { success: true };
    }),
  delete: authorizedProcedure
    .input(changeCommentSchema)
    .handler(async ({ context, input }) => {
      await assertDiscussionAccess(context, input);
      const comment = await findComment(input);
      assertCommentAuthor(
        comment.userId,
        context.user.id,
        (await getTranslations("errors.comments"))("notAuthor")
      );
      await db
        .update(discussionComments)
        .set({ body: "", deletedAt: new Date() })
        .where(eq(discussionComments.id, comment.id));
      await publishCommentChange(input);
      return { success: true };
    }),
  react: authorizedProcedure
    .input(reactCommentSchema)
    .handler(async ({ context, input }) => {
      await assertDiscussionAccess(context, input);
      const comment = await findComment(input);
      if (comment.deletedAt) {
        const tErrors = await getTranslations("errors.comments");
        throw badRequest(tErrors("deleted"));
      }
      if (input.active) {
        await db
          .insert(discussionReactions)
          .values({
            id: crypto.randomUUID(),
            commentId: comment.id,
            userId: context.user.id,
            emoji: input.emoji,
          })
          .onConflictDoNothing();
      } else {
        await db
          .delete(discussionReactions)
          .where(
            and(
              eq(discussionReactions.commentId, comment.id),
              eq(discussionReactions.userId, context.user.id),
              eq(discussionReactions.emoji, input.emoji)
            )
          );
      }
      await publishCommentChange(input);
      return { success: true };
    }),
};
