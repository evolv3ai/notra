import type { Context } from "hono";

import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import type { ApiEnv } from "../types/env";
import { getOrganizationId } from "../utils/auth";
import { createOpenApiApp } from "../utils/openapi-app";
import {
  ORGANIZATION_POST_PATH_REGEX,
  ORGANIZATION_POSTS_PATH_REGEX,
} from "../utils/regex";

export function redirectLegacyOrganizationPath(
  pattern: RegExp,
  canonicalPath: (param: (key: string) => string | undefined) => string
) {
  return (c: Context<ApiEnv>) => {
    c.get("log").set({ legacyRedirect: true });
    const orgId = getOrganizationId(c);
    if (!orgId) {
      return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
    }

    if (orgId !== c.req.param("organizationId")) {
      return c.json({ error: "Forbidden: organization access denied" }, 403);
    }

    const url = new URL(c.req.url);
    const path = url.pathname.replace(
      pattern,
      canonicalPath((key) => c.req.param(key))
    );
    return c.redirect(`${path}${url.search}`, 308);
  };
}

export const legacyRedirectRoutes = createOpenApiApp();

legacyRedirectRoutes.get(
  "/:organizationId/posts",
  redirectLegacyOrganizationPath(ORGANIZATION_POSTS_PATH_REGEX, () => "/posts")
);

legacyRedirectRoutes.on(
  ["GET", "PATCH"],
  "/:organizationId/posts/:postId",
  redirectLegacyOrganizationPath(
    ORGANIZATION_POST_PATH_REGEX,
    (param) => `/posts/${param("postId")}`
  )
);
