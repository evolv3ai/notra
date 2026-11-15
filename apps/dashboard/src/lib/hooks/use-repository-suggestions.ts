import { useQuery } from "@tanstack/react-query";

import { SITE_REPOSITORY_SUGGESTIONS_STALE_MS } from "@/constants/sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  RepositorySuggestionsResult,
  RepositorySuggestionsScope,
} from "@/types/sites";

export function useRepositorySuggestions(
  scope: RepositorySuggestionsScope
): RepositorySuggestionsResult {
  const { organizationId, branch } = scope;
  const repositoryId = "repositoryId" in scope ? scope.repositoryId : null;
  const siteId = "siteId" in scope ? scope.siteId : null;

  const base = useRepositorySuggestionsQuery(
    organizationId,
    repositoryId,
    siteId,
    undefined
  );
  const selectedBranch = branch.trim();
  const useSelectedBranch = Boolean(
    selectedBranch && selectedBranch !== base.data?.defaultBranch
  );
  const onBranch = useRepositorySuggestionsQuery(
    organizationId,
    repositoryId,
    siteId,
    useSelectedBranch ? selectedBranch : undefined,
    useSelectedBranch && base.data?.branches.includes(selectedBranch) === true
  );
  const selected = useSelectedBranch ? onBranch : base;
  const isReady = selected.data !== undefined && !selected.isFetching;
  const scanned = isReady ? selected.data : undefined;
  const directories = scanned?.configDirectories ?? [];
  return {
    branches: base.data?.branches ?? [],
    defaultBranch: base.data?.defaultBranch ?? null,
    configDirectories: directories,
    contentCounts: scanned?.contentCounts,
    isLoading:
      Boolean(repositoryId ?? siteId) &&
      (base.isPending || selected.isFetching),
    isReady,
    isComplete: scanned?.truncated === false,
  };
}

function useRepositorySuggestionsQuery(
  organizationId: string,
  repositoryId: string | null,
  siteId: string | null,
  ref: string | undefined,
  enabled = true
) {
  const siteQuery = useQuery({
    ...dashboardOrpc.sites.siteRepositorySuggestions.queryOptions({
      input: { organizationId, siteId: siteId ?? "site_", ref },
    }),
    enabled: enabled && Boolean(siteId),
    staleTime: SITE_REPOSITORY_SUGGESTIONS_STALE_MS,
    retry: false,
  });
  const repositoryQuery = useQuery({
    ...dashboardOrpc.sites.repositorySuggestions.queryOptions({
      input: { organizationId, repositoryId: repositoryId ?? "", ref },
    }),
    enabled: enabled && Boolean(repositoryId),
    staleTime: SITE_REPOSITORY_SUGGESTIONS_STALE_MS,
    retry: false,
  });
  return siteId ? siteQuery : repositoryQuery;
}
