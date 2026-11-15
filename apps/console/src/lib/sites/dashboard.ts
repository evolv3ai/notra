import "server-only";
import { callDashboard } from "@/lib/dashboard";
import type { SiteAdminRequest } from "@/types/sites";

const SITE_ADMIN_PATH = "/api/internal/sites/admin";

/**
 * Calls the dashboard's internal site admin route. Builds, rollbacks,
 * suspensions and Tinybird analytics run there because they depend on
 * `@notra/sites-server` and the dashboard's workflow runtime.
 */
export function callSiteAdmin(input: SiteAdminRequest): Promise<unknown> {
  return callDashboard(SITE_ADMIN_PATH, input);
}
