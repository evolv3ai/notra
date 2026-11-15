import type { SessionContext } from "eve/context";

import type { OrganizationContext } from "../types/organization";
import { getSessionAttribute } from "./session";

export function getOrganizationId(ctx: OrganizationContext): string | null {
  return getSessionAttribute(ctx, "organizationId");
}

export function requireOrganizationId(ctx: SessionContext): string {
  const organizationId = getOrganizationId(ctx);
  if (!organizationId) {
    throw new Error(
      "No organization is bound to this session. Organization-scoped tools are unavailable on research-only runs."
    );
  }
  return organizationId;
}
