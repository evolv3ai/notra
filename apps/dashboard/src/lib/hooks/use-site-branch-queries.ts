import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteBranchControlsProps } from "@/types/site-branches";
import { siteDraftValidationOptions } from "@/utils/site-draft-validation-options";
import { siteValidationBlocksReview } from "@/utils/site-validation-ready";

/** Branch status, validation and the branch list behind the editor's branch controls. */
export function useSiteBranchQueries({
  organizationId,
  siteId,
  branch,
  productionBranch,
  draftVersion,
  unsaved,
}: SiteBranchControlsProps) {
  const scope = { organizationId, siteId, branch };
  const statusOptions = dashboardOrpc.sites.branches.status.queryOptions({
    input: scope,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
  const status = useQuery(statusOptions);
  // Autosave already debounces edits. Validate each acknowledged revision
  // immediately, without reusing the result for an older draft.
  const validation = useQuery(
    siteDraftValidationOptions(scope, draftVersion, !unsaved)
  );
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const branches = useQuery(
    dashboardOrpc.sites.branches.list.queryOptions({
      input: { organizationId, siteId },
      enabled: menuOpen,
      staleTime: 30_000,
    })
  );
  const feature = Boolean(branch && branch !== productionBranch);
  return {
    status,
    validation,
    validating: !unsaved && validation.isPending,
    branches,
    search,
    setSearch,
    menuOpen,
    setMenuOpen,
    feature,
    current: branch ?? productionBranch,
    invalid: siteValidationBlocksReview(validation) || status.isError,
  };
}
