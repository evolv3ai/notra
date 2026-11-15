import { db } from "@notra/db/drizzle";
import { contentAuthors, posts, users } from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { CONTENT_AUTHOR_SLUG_MAX_LENGTH } from "@notra/schemas/constants/dashboard/post-metadata";
import {
  contentOrganizationIdInputSchema,
  createContentAuthorInputSchema,
  deleteContentAuthorInputSchema,
  updateContentAuthorInputSchema,
} from "@notra/schemas/dashboard/content";
import { and, asc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { CONTENT_AUTHOR_ENSURE_SELF_ATTEMPTS } from "@/constants/content-overview";
import { getTranslations } from "@/lib/i18n/server";
import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import {
  authorSlugBase,
  serializeContentAuthor,
} from "@/utils/content-authors";

import { conflict, notFound } from "../utils/errors";

async function freeAuthorSlug(organizationId: string, name: string) {
  const base = authorSlugBase(name);
  const taken = new Set(
    (
      await db
        .select({ slug: contentAuthors.slug })
        .from(contentAuthors)
        .where(
          and(
            eq(contentAuthors.organizationId, organizationId),
            sql`${contentAuthors.slug} like ${`${base}%`}`
          )
        )
    ).map((row) => row.slug)
  );
  if (!taken.has(base)) {
    return base;
  }
  for (let suffix = 2; ; suffix++) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, CONTENT_AUTHOR_SLUG_MAX_LENGTH - tail.length)}${tail}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

async function toAuthorSlugConflict(error: unknown) {
  if (!isPgUniqueViolation(error)) {
    return error;
  }
  const t = await getTranslations("errors.content");
  return conflict(t("authorSlugTaken"));
}

export const contentAuthorsRouter = {
  list: baseProcedure
    .input(contentOrganizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      const rows = await db
        .select()
        .from(contentAuthors)
        .where(eq(contentAuthors.organizationId, input.organizationId))
        .orderBy(asc(contentAuthors.name));
      return {
        authors: rows.map(serializeContentAuthor),
        currentUserId: auth.user.id,
      };
    }),

  ensureSelf: baseProcedure
    .input(contentOrganizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      const findOwn = () =>
        db.query.contentAuthors.findFirst({
          where: and(
            eq(contentAuthors.organizationId, input.organizationId),
            eq(contentAuthors.userId, auth.user.id)
          ),
        });
      const existing = await findOwn();
      if (existing) {
        return { author: serializeContentAuthor(existing) };
      }
      const profile = await db.query.users.findFirst({
        where: eq(users.id, auth.user.id),
        columns: { name: true, image: true },
      });
      const name = profile?.name.trim() || auth.user.email || "Author";
      for (let attempt = 1; ; attempt++) {
        const slug = await freeAuthorSlug(input.organizationId, name);
        try {
          const [created] = await db
            .insert(contentAuthors)
            .values({
              id: nanoid(16),
              organizationId: input.organizationId,
              slug,
              name,
              avatarUrl: profile?.image ?? null,
              userId: auth.user.id,
            })
            .returning();
          if (!created) {
            throw new Error("Author insert returned no row");
          }
          return { author: serializeContentAuthor(created) };
        } catch (error) {
          if (!isPgUniqueViolation(error)) {
            throw error;
          }
          const raced = await findOwn();
          if (raced) {
            return { author: serializeContentAuthor(raced) };
          }
          if (attempt >= CONTENT_AUTHOR_ENSURE_SELF_ATTEMPTS) {
            throw error;
          }
        }
      }
    }),

  create: baseProcedure
    .input(createContentAuthorInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      try {
        const [created] = await db
          .insert(contentAuthors)
          .values({
            id: nanoid(16),
            organizationId: input.organizationId,
            ...input.author,
          })
          .returning();
        if (!created) {
          throw new Error("Author insert returned no row");
        }
        return { author: serializeContentAuthor(created) };
      } catch (error) {
        throw await toAuthorSlugConflict(error);
      }
    }),

  update: baseProcedure
    .input(updateContentAuthorInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      try {
        const [updated] = await db
          .update(contentAuthors)
          .set(input.author)
          .where(
            and(
              eq(contentAuthors.id, input.authorId),
              eq(contentAuthors.organizationId, input.organizationId)
            )
          )
          .returning();
        if (!updated) {
          throw notFound("Author not found");
        }
        return { author: serializeContentAuthor(updated) };
      } catch (error) {
        throw await toAuthorSlugConflict(error);
      }
    }),

  delete: baseProcedure
    .input(deleteContentAuthorInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      await db.transaction(async (tx) => {
        const [deleted] = await tx
          .delete(contentAuthors)
          .where(
            and(
              eq(contentAuthors.id, input.authorId),
              eq(contentAuthors.organizationId, input.organizationId)
            )
          )
          .returning({ id: contentAuthors.id });
        if (!deleted) {
          throw notFound("Author not found");
        }
        await tx
          .update(posts)
          .set({
            authorIds: sql`array_remove(${posts.authorIds}, ${input.authorId})`,
          })
          .where(
            and(
              eq(posts.organizationId, input.organizationId),
              sql`${input.authorId} = any(${posts.authorIds})`
            )
          );
      });
      return { success: true };
    }),
};
