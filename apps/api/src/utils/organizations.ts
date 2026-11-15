import { organizations } from "@notra/db/schema";
import { eq } from "drizzle-orm";
import type { Context } from "hono";

import {
  ORGANIZATION_CACHE_MAX_SIZE,
  ORGANIZATION_CACHE_TTL_MS,
} from "../constants/organizations";
import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import type { DbClient } from "../types/db";
import type { ApiEnv } from "../types/env";
import type { OrganizationResponse } from "../types/organizations";
import { getOrganizationId } from "./auth";

const organizationCache = new Map<
  string,
  { organization: OrganizationResponse; expiresAt: number }
>();

export async function getOrganizationResponse(
  db: DbClient,
  organizationId: string
): Promise<OrganizationResponse | undefined> {
  const cached = organizationCache.get(organizationId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.organization;
  }
  organizationCache.delete(organizationId);

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      id: true,
      slug: true,
      name: true,
      logo: true,
    },
  });

  if (organization) {
    if (organizationCache.size >= ORGANIZATION_CACHE_MAX_SIZE) {
      const oldestKey = organizationCache.keys().next().value;
      if (oldestKey !== undefined) {
        organizationCache.delete(oldestKey);
      }
    }
    organizationCache.set(organizationId, {
      organization,
      expiresAt: Date.now() + ORGANIZATION_CACHE_TTL_MS,
    });
  }

  return organization;
}

export async function resolveRequestOrganization(c: Context<ApiEnv>) {
  const orgId = getOrganizationId(c);
  if (!orgId) {
    return {
      response: c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403),
    };
  }

  const organization = await getOrganizationResponse(c.get("db"), orgId);
  if (!organization) {
    return { response: c.json({ error: "Organization not found" }, 404) };
  }

  return { orgId, organization };
}
