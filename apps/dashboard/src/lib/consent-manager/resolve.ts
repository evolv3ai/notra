import { isDemoModeClient } from "@notra/utils/demo-mode";
import { resolveConsent } from "c15t/tanstack-start/server";

export function resolveDashboardConsent(language: string, request?: Request) {
  if (isDemoModeClient()) {
    return null;
  }

  return resolveConsent({
    language,
    request,
    proxy: true,
    routePrefix: "/api/c15t",
  });
}
