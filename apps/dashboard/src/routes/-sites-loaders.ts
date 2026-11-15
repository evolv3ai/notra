import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { validateOrganizationAccess } from "@/lib/auth/actions";
import type { UiRouteInput } from "@/types/ui-route";

export const loadSite = createServerFn({
  method: "GET",
  strict: { output: false },
})
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params, searchParams } }) => {
    const { organization, user, member } = await validateOrganizationAccess(
      params.slug ?? ""
    );
    const { dehydrateSiteQueries } =
      await import("@/utils/site-prefetch.server");
    const branch = searchParams.branch;
    return await dehydrateSiteQueries(
      organization.id,
      params.siteId ?? "",
      typeof branch === "string" && branch ? branch : undefined,
      getRequestHeaders(),
      member && { userId: user.id, id: member.id, role: member.role }
    );
  });

export const loadSiteName = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params } }) => {
    const [{ organization }, site] = await Promise.all([
      validateOrganizationAccess(params.slug ?? ""),
      import("@notra/sites-server/deployments").then(({ getSite }) =>
        getSite(params.siteId ?? "")
      ),
    ]);
    return site?.organizationId === organization.id ? site.name : null;
  });
