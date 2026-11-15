import { isPostSlugConflict } from "@notra/ai/utils/post-service";
import { db } from "@notra/db/drizzle";
import { contentAuthors, posts, postVersions, users } from "@notra/db/schema";
import {
  checkpointPostHistory,
  PostHistoryError,
  setPostHistoryContext,
  supportsPostHistory,
} from "@notra/db/utils/post-history";
import { contentAuthorsInOrganization } from "@notra/db/utils/post-metadata";
import {
  contentHistoryCheckpointInputSchema,
  contentHistoryListInputSchema,
  contentHistoryMetadataSchema,
  contentHistoryRestoreInputSchema,
  contentHistoryVersionInputSchema,
} from "@notra/schemas/dashboard/content-history";
import { and, count, desc, eq, lt, sql } from "drizzle-orm";

import { assertOrganizationAccess } from "@/lib/auth/organization";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import { getTranslations } from "@/lib/i18n/server";
import { baseProcedure } from "@/lib/orpc/base";
import { badRequest, conflict, notFound } from "@/lib/orpc/utils/errors";
import {
  contentHistoryChanges,
  contentHistoryRestoreData,
  serializeContentHistoryEntry,
} from "@/utils/content-history-server";

export const contentHistoryRouter = {
  list: baseProcedure
    .input(contentHistoryListInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
      });
      const [[document], t] = await Promise.all([
        db
          .select({ revision: posts.revision, contentType: posts.contentType })
          .from(posts)
          .where(
            and(
              eq(posts.id, input.contentId),
              eq(posts.organizationId, input.organizationId)
            )
          ),
        getTranslations("errors.content"),
      ]);
      if (!document) {
        throw notFound(t("historyNotFound"));
      }
      if (!supportsPostHistory(document.contentType)) {
        throw badRequest(t("historyNotSupported"));
      }
      const scope = and(
        eq(postVersions.organizationId, input.organizationId),
        eq(postVersions.postId, input.contentId),
        input.cursor === undefined
          ? undefined
          : lt(postVersions.revision, input.cursor)
      );
      const [rows, [counted]] = await Promise.all([
        db
          .select({
            id: postVersions.id,
            revision: postVersions.revision,
            title: postVersions.title,
            slug: postVersions.slug,
            metadata: postVersions.metadata,
            markdownHash: sql<string>`md5(coalesce(${postVersions.markdown}, ''))`,
            createdAt: postVersions.createdAt,
            source: postVersions.source,
            retained: postVersions.retained,
            actorUserId: postVersions.actorUserId,
            actorName: users.name,
          })
          .from(postVersions)
          .leftJoin(users, eq(users.id, postVersions.actorUserId))
          .where(scope)
          .orderBy(desc(postVersions.revision))
          .limit(input.limit + 1),
        db.select({ total: count() }).from(postVersions).where(scope),
      ]);
      const total = counted?.total ?? rows.length;
      const items = rows.slice(0, input.limit).map((row, index) => ({
        ...serializeContentHistoryEntry(row),
        changes: contentHistoryChanges(row, rows[index + 1]),
        number: total - index,
      }));
      return {
        items,
        nextCursor:
          rows.length > input.limit ? (items.at(-1)?.revision ?? null) : null,
        currentRevision: document.revision,
      };
    }),
  get: baseProcedure
    .input(contentHistoryVersionInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
      });
      const [[version], t] = await Promise.all([
        db
          .select({
            id: postVersions.id,
            revision: postVersions.revision,
            title: postVersions.title,
            slug: postVersions.slug,
            markdown: postVersions.markdown,
            metadata: postVersions.metadata,
            createdAt: postVersions.createdAt,
            source: postVersions.source,
            retained: postVersions.retained,
            actorUserId: postVersions.actorUserId,
            actorName: users.name,
          })
          .from(postVersions)
          .leftJoin(users, eq(users.id, postVersions.actorUserId))
          .where(
            and(
              eq(postVersions.organizationId, input.organizationId),
              eq(postVersions.postId, input.contentId),
              eq(postVersions.id, input.versionId)
            )
          ),
        getTranslations("errors.content"),
      ]);
      if (!version) {
        throw notFound(t("historyNotFound"));
      }
      const metadata = contentHistoryMetadataSchema.safeParse(version.metadata);
      if (!metadata.success) {
        throw badRequest(t("historyUnavailable"));
      }
      return {
        version: {
          ...serializeContentHistoryEntry(version),
          slug: version.slug,
          markdown: version.markdown,
          metadata: metadata.data,
        },
      };
    }),
  checkpoint: baseProcedure
    .input(contentHistoryCheckpointInputSchema)
    .handler(async ({ context, input }) => {
      const auth = await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
      });
      await assertActiveSubscription(input.organizationId);
      try {
        return await db.transaction((tx) =>
          checkpointPostHistory(tx, {
            organizationId: input.organizationId,
            postId: input.contentId,
            expectedRevision: input.expectedRevision,
            actorUserId: auth.user.id,
            source: input.manual ? "editor_save" : "checkpoint",
          })
        );
      } catch (error) {
        if (!(error instanceof PostHistoryError)) {
          throw error;
        }
        const t = await getTranslations("errors.content");
        if (error.code === "CONFLICT") {
          throw conflict(t("concurrentEdit"), {
            currentRevision: error.currentRevision,
          });
        }
        if (error.code === "NOT_FOUND") {
          throw notFound(t("historyNotFound"));
        }
        throw badRequest(t("historyNotSupported"));
      }
    }),
  restore: baseProcedure
    .input(contentHistoryRestoreInputSchema)
    .handler(async ({ context, input }) => {
      const auth = await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
      });
      await assertActiveSubscription(input.organizationId);
      const t = await getTranslations("errors.content");
      try {
        return await db.transaction(async (tx) => {
          const [document] = await tx
            .select({
              revision: posts.revision,
              contentType: posts.contentType,
            })
            .from(posts)
            .where(
              and(
                eq(posts.id, input.contentId),
                eq(posts.organizationId, input.organizationId)
              )
            )
            .for("update");
          if (!document) {
            throw notFound(t("historyNotFound"));
          }
          if (!supportsPostHistory(document.contentType)) {
            throw badRequest(t("historyNotSupported"));
          }
          if (document.revision !== input.expectedRevision) {
            throw conflict(t("concurrentEdit"), {
              currentRevision: document.revision,
            });
          }
          const [version] = await tx
            .select()
            .from(postVersions)
            .where(
              and(
                eq(postVersions.id, input.versionId),
                eq(postVersions.organizationId, input.organizationId),
                eq(postVersions.postId, input.contentId)
              )
            );
          if (!version) {
            throw notFound(t("historyNotFound"));
          }
          const metadata = contentHistoryMetadataSchema.safeParse(
            version.metadata
          );
          if (
            !metadata.success ||
            metadata.data.contentType !== document.contentType ||
            version.markdown === null
          ) {
            throw badRequest(t("historyUnavailable"));
          }
          const authorIds = new Set(
            metadata.data.authorIds.length > 0
              ? (
                  await tx
                    .select({ id: contentAuthors.id })
                    .from(contentAuthors)
                    .where(
                      contentAuthorsInOrganization(
                        input.organizationId,
                        metadata.data.authorIds
                      )
                    )
                ).map((author) => author.id)
              : []
          );
          const update = await contentHistoryRestoreData({
            title: version.title,
            slug: version.slug,
            markdown: version.markdown,
            metadata: {
              ...metadata.data,
              authorIds: metadata.data.authorIds.filter((id) =>
                authorIds.has(id)
              ),
            },
          });
          await setPostHistoryContext(tx, {
            actorUserId: auth.user.id,
            source: "restore",
          });
          const [restored] = await tx
            .update(posts)
            .set(update)
            .where(
              and(
                eq(posts.id, input.contentId),
                eq(posts.organizationId, input.organizationId)
              )
            )
            .returning({ revision: posts.revision });
          return { success: true, revision: restored?.revision ?? 0 };
        });
      } catch (error) {
        if (isPostSlugConflict(error)) {
          throw conflict(t("slugTaken"));
        }
        throw error;
      }
    }),
};
