import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  SITE_BRANCH_AUTOCOMMIT_MS,
  SITE_BRANCH_LEAVE_ERROR_KEY,
} from "@/constants/site-branches";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteScope } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import { flushSiteBranchOnLeave } from "@/utils/flush-site-branch-on-leave";
import { invalidateSiteBranch } from "@/utils/invalidate-site-branch";
import { publishConflictPaths } from "@/utils/site-drafts";

export function useSiteBranchAutosave(
  scope: SiteScope,
  enabled: boolean,
  draftVersion: string,
  draftCount: number,
  unsaved: boolean,
  flushBuffers: () => Promise<void>,
  onFlushed: () => void,
  onConflict: (paths: string[]) => void
) {
  const t = useTranslations("sites.branches");
  const client = useQueryClient();
  const pending = useRef(false);
  const attemptedVersion = useRef("");
  const mutation = useMutation({
    mutationFn: async () => {
      attemptedVersion.current = draftVersion;
      await flushBuffers();
      if (enabled && scope.branch) {
        await dashboardOrpc.sites.branches.flush.call({
          ...scope,
          branch: scope.branch,
        });
      }
    },
    onSuccess: async () => {
      pending.current = false;
      await invalidateSiteBranch(client, scope);
      onFlushed();
    },
    onError: (error) => {
      sessionStorage.setItem(SITE_BRANCH_LEAVE_ERROR_KEY, "1");
      const paths = publishConflictPaths(error);
      if (paths) {
        onConflict(paths);
      }
      toast.error(toErrorMessage(error, t("saveFailed")));
    },
  });
  const save = useEffectEvent(() => mutation.mutate());
  const leave = useEffectEvent(() => {
    if (enabled && pending.current && !mutation.isPending) {
      mutation.mutate();
    }
  });
  useEffect(() => {
    pending.current = draftCount > 0 || unsaved;
    if (
      !enabled ||
      draftCount === 0 ||
      unsaved ||
      mutation.isPending ||
      (mutation.isError && attemptedVersion.current === draftVersion)
    ) {
      return;
    }
    const timer = setTimeout(save, SITE_BRANCH_AUTOCOMMIT_MS);
    return () => clearTimeout(timer);
  }, [
    enabled,
    draftVersion,
    draftCount,
    unsaved,
    mutation.isPending,
    mutation.isError,
  ]);
  const pageHide = useEffectEvent(() => {
    if (
      !enabled ||
      (!pending.current && draftCount === 0 && !unsaved) ||
      !scope.branch
    ) {
      return;
    }
    void flushSiteBranchOnLeave(scope)
      .then(() => invalidateSiteBranch(client, scope))
      .then(onFlushed)
      .catch(() => {
        sessionStorage.setItem(SITE_BRANCH_LEAVE_ERROR_KEY, "1");
      });
  });
  useEffect(() => {
    window.addEventListener("pagehide", pageHide);
    return () => window.removeEventListener("pagehide", pageHide);
  }, []);
  useEffect(() => {
    if (sessionStorage.getItem(SITE_BRANCH_LEAVE_ERROR_KEY)) {
      sessionStorage.removeItem(SITE_BRANCH_LEAVE_ERROR_KEY);
      toast.error(t("saveFailed"));
    }
    return () => leave();
  }, [t]);
  return {
    ...mutation,
    commitInBackground: () => {
      if (!(enabled && pending.current && scope.branch)) {
        return;
      }
      if (!mutation.isPending) {
        mutation.mutate();
        return;
      }
      // The running commit only covers its own revision; the server queues
      // this flush behind it so newer drafts still reach GitHub.
      void dashboardOrpc.sites.branches.flush
        .call({ ...scope, branch: scope.branch })
        .then(() => invalidateSiteBranch(client, scope))
        .catch((error: unknown) =>
          toast.error(toErrorMessage(error, t("saveFailed")))
        );
    },
    suppressLeave: () => {
      pending.current = false;
    },
  };
}
