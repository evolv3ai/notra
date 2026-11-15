import type { SiteStarterInput } from "@/types/sites";

export function normalizeSiteStarterRoot(rootDirectory: string): string {
  return rootDirectory.trim().replace(/^\/+|\/+$/g, "");
}

export function siteStarterScopeKey(scope: SiteStarterInput): string {
  return JSON.stringify([
    scope.organizationId,
    scope.repositoryId,
    scope.branch.trim(),
    normalizeSiteStarterRoot(scope.rootDirectory),
  ]);
}
