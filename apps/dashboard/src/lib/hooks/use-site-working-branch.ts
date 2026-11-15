import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useSiteBranchAutosave } from "@/lib/hooks/use-site-branch-autosave";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { UseSiteWorkingBranchParams } from "@/types/hooks/site-working-branch";
import { isInvalidSiteBranchError } from "@/utils/invalid-site-branch";
import { invalidateSiteBranch } from "@/utils/invalidate-site-branch";

export function useSiteWorkingBranch({
  organizationId,
  siteId,
  branch,
  productionBranch,
  filesError,
  draftVersion,
  draftCount,
  paused = false,
  saves,
  onFlushed,
  onConflict,
  onSwitch,
}: UseSiteWorkingBranchParams) {
  const t = useTranslations("sites.branches");
  const client = useQueryClient();
  const recovering = useRef(false);
  const branchStatus = useQuery(
    dashboardOrpc.sites.branches.status.queryOptions({
      input: { organizationId, siteId, branch },
      staleTime: 30_000,
    })
  );
  useEffect(() => {
    if (
      branch &&
      !recovering.current &&
      (isInvalidSiteBranchError(filesError) ||
        isInvalidSiteBranchError(branchStatus.error))
    ) {
      recovering.current = true;
      void onSwitch(null).then(() =>
        toast.info(t("branchNotFound", { branch: productionBranch }))
      );
    }
  }, [branch, filesError, branchStatus.error, onSwitch, productionBranch, t]);
  const feature = Boolean(
    branch && branch !== productionBranch && branchStatus.data?.canEdit === true
  );
  const autoCommit = useSiteBranchAutosave(
    { organizationId, siteId, branch },
    feature && !paused,
    draftVersion,
    draftCount,
    saves.unsaved,
    saves.flush,
    onFlushed,
    onConflict
  );
  return {
    branchStatus,
    commitStatus: autoCommit.status,
    flush: async () => {
      if (feature) {
        await autoCommit.mutateAsync();
      } else {
        await saves.flush();
      }
    },
    switchBranch: async (next: string) => {
      // Commit what the branch being left still holds without making the
      // switch wait for GitHub.
      autoCommit.commitInBackground();
      autoCommit.suppressLeave();
      // Mark the data stale without refetching the branch being left; the
      // next branch loads its own queries as it mounts.
      void invalidateSiteBranch(client, { organizationId, siteId }, "none");
      await onSwitch(next === productionBranch ? null : next);
    },
  };
}
