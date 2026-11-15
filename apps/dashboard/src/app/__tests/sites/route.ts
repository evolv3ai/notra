import { db } from "@notra/db/drizzle";
import { members, organizations, sites } from "@notra/db/schema";
import { isSitesConfigured } from "@notra/sites-server/env";
import { and, eq } from "drizzle-orm";

import { getAuthSession } from "@/lib/auth/server";
import { isSitesTestRequestAllowed } from "@/utils/sites-test-access";

export async function GET(request: Request): Promise<Response> {
  if (!isSitesTestRequestAllowed(request)) {
    return new Response(null, { status: 404 });
  }
  const auth = await getAuthSession();
  if (!auth) {
    return new Response(null, { status: 401 });
  }
  const organizationId = auth.session.activeOrganizationId;
  if (!organizationId) {
    return new Response(null, { status: 403 });
  }
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, auth.user.id),
      eq(members.organizationId, organizationId)
    ),
    columns: { id: true },
  });
  if (!membership) {
    return new Response(null, { status: 403 });
  }
  const [organization, associatedSites] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { id: true, slug: true },
    }),
    db.query.sites.findMany({
      where: eq(sites.organizationId, organizationId),
      columns: { id: true, projectId: true, name: true, slug: true },
    }),
  ]);
  return Response.json(
    {
      organization,
      sites: associatedSites,
      sitesRuntimeConfigured: isSitesConfigured(),
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
