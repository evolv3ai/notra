import { isProjectInOrganization } from "@notra/db/utils/projects";
import type { Context, Next } from "hono";

import { GEO_PROJECT_NOT_FOUND_ERROR } from "../constants/geo";
import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import type { ApiEnv } from "../types/env";
import { getOrganizationId } from "../utils/auth";
import { getOrganizationResponse } from "../utils/organizations";

export function geoContextMiddleware() {
  return async (c: Context<ApiEnv>, next: Next) => {
    const organizationId = getOrganizationId(c);
    if (!organizationId) {
      return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
    }

    const db = c.get("db");
    const organization = await getOrganizationResponse(db, organizationId);
    if (!organization) {
      return c.json({ error: "Organization not found" }, 404);
    }

    c.set("geo", { db, organization, organizationId });
    await next();
  };
}

export function geoProjectContextMiddleware() {
  return async (c: Context<ApiEnv>, next: Next) => {
    const projectId = c.req.param("projectId");
    const { db, organizationId } = c.get("geo");
    if (
      !projectId ||
      !(await isProjectInOrganization(organizationId, projectId, db))
    ) {
      return c.json({ error: GEO_PROJECT_NOT_FOUND_ERROR }, 404);
    }

    await next();
  };
}
