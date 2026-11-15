import type { createDb } from "@notra/db/drizzle";

import type { getOrganizationResponse } from "../utils/organizations";

export interface GeoRequestContext {
  readonly db: ReturnType<typeof createDb>;
  readonly organization: NonNullable<
    Awaited<ReturnType<typeof getOrganizationResponse>>
  >;
  readonly organizationId: string;
}
