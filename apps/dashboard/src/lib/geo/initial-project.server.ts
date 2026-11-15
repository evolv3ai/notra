import { db } from "@notra/db/drizzle";
import { projects } from "@notra/db/schema";
import { GEO_PROJECTS_OLDEST_ORDER } from "@notra/geo-core/constants/geo-projects";
import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { retryTransientDbError } from "@/lib/db/retry";
import { getLastVisitedProject } from "@/utils/cookies";
import { readServerCookies as cookies } from "@/utils/server-cookies";

export const resolveInitialGeoProjectId = cache(
  async (
    organizationId: string,
    organizationSlug: string,
    requestedProjectId: string | undefined
  ): Promise<string | undefined> => {
    if (requestedProjectId) {
      const requested = await findOrgProject(
        organizationId,
        requestedProjectId
      );
      if (requested) {
        return requested.id;
      }
    }

    return resolveFallbackGeoProjectId(organizationId, organizationSlug);
  }
);

const resolveFallbackGeoProjectId = cache(
  async (
    organizationId: string,
    organizationSlug: string
  ): Promise<string | undefined> => {
    const cookieStore = await cookies();
    const lastVisitedProjectId = getLastVisitedProject(
      cookieStore,
      organizationSlug
    );

    if (lastVisitedProjectId) {
      const lastVisited = await findOrgProject(
        organizationId,
        lastVisitedProjectId
      );
      if (lastVisited) {
        return lastVisited.id;
      }
    }

    const oldest = await retryTransientDbError(() =>
      db.query.projects.findFirst({
        columns: { id: true },
        where: eq(projects.organizationId, organizationId),
        orderBy: GEO_PROJECTS_OLDEST_ORDER,
      })
    );
    return oldest?.id;
  }
);

function findOrgProject(organizationId: string, projectId: string) {
  return retryTransientDbError(() =>
    db.query.projects.findFirst({
      columns: { id: true },
      where: and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId)
      ),
    })
  );
}
