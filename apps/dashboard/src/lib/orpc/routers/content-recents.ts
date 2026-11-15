import { db } from "@notra/db/drizzle";
import { posts } from "@notra/db/schema";
import { projectScopedCollectionIds } from "@notra/db/utils/projects";
import { contentRecentsQuerySchema } from "@notra/schemas/dashboard/api-params";
import { contentOrganizationIdInputSchema } from "@notra/schemas/dashboard/content";
import { and, desc, eq, inArray } from "drizzle-orm";

import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";

/**
 * Kept out of the content router: GEO and home pages prefetch the sidebar
 * recents on the server, and the full router (GitHub, Linear, S3 publishing)
 * costs far more to load on a cold instance than this query takes to run.
 */
export const contentRecentsProcedure = baseProcedure
  .input(contentOrganizationIdInputSchema.and(contentRecentsQuerySchema))
  .use(withOrganizationAccess)
  .handler(async ({ input }) => {
    const filters = [eq(posts.organizationId, input.organizationId)];
    const collectionIds = projectScopedCollectionIds(
      input.organizationId,
      input.projectId
    );
    if (collectionIds) {
      filters.push(inArray(posts.collectionId, collectionIds));
    }

    const items = await db.query.posts.findMany({
      where: and(...filters),
      orderBy: [desc(posts.createdAt), desc(posts.id)],
      limit: input.limit,
      columns: {
        id: true,
        title: true,
        status: true,
      },
    });

    return { posts: items };
  });
