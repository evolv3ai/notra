import { isDemoMode } from "@notra/utils/demo-mode";

import { assertOrganizationAccess } from "@/lib/auth/organization";
import { forbidden } from "@/lib/orpc/utils/errors";

export async function assertSitesAccess(
  params: Parameters<typeof assertOrganizationAccess>[0]
): Promise<void> {
  await assertOrganizationAccess(params);
  if (isDemoMode()) {
    throw forbidden("Notra Sites is not available in demo mode");
  }
}
