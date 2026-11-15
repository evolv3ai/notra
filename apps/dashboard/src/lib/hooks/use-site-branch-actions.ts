import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { SITE_PUBLISHED_EVENT } from "@/constants/sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  SiteBranchControlsProps,
  SiteBranchEditInput,
  SiteBranchDialogProps,
} from "@/types/site-branches";
import { toErrorMessage } from "@/utils/error-message";
import { invalidateSiteBranch } from "@/utils/invalidate-site-branch";
import { seedCreatedSiteBranch } from "@/utils/seed-created-site-branch";

export function useSiteBranchActions(
  props: SiteBranchControlsProps,
  action: SiteBranchDialogProps["action"],
  onClose: () => void
) {
  const { organizationId, siteId, branch, onSwitch, onFlush } = props;
  const client = useQueryClient();
  const t = useTranslations("sites.branches");
  const invalidate = () =>
    invalidateSiteBranch(client, { organizationId, siteId });
  const openCreated = async (created: string, bringChanges: boolean) => {
    seedCreatedSiteBranch(
      client,
      { organizationId, siteId, branch },
      created,
      bringChanges && props.draftCount > 0
    );
    await onSwitch(created);
  };
  const onError = (error: unknown) =>
    toast.error(toErrorMessage(error, t("actionFailed")));
  const create = useMutation({
    mutationFn: async (title: string) => {
      await onFlush();
      const created = await dashboardOrpc.sites.branches.create.call({
        organizationId,
        siteId,
        branch,
        title,
        bringChanges: true,
      });
      await openCreated(created.branch, true);
    },
    onSuccess: () => {
      onClose();
      void invalidate();
    },
    onError,
  });
  const edit = useMutation({
    mutationFn: async (input: SiteBranchEditInput) => {
      if (!action) {
        return;
      }
      if (action.kind !== "discardDeleted") {
        await onFlush();
      }
      const scope = { organizationId, siteId, branch: action.branch };
      if (action.kind === "create") {
        const created = await dashboardOrpc.sites.branches.create.call({
          ...scope,
          ...input,
        });
        await openCreated(created.branch, input.bringChanges);
      } else if (action.kind === "rename") {
        const renamed = await dashboardOrpc.sites.branches.rename.call({
          ...scope,
          title: input.title,
        });
        if (action.branch === branch) {
          await onSwitch(renamed.branch);
        }
      } else if (action.kind === "discardDeleted") {
        await Promise.all(
          (action.branches ?? [action.branch]).map((deleted) =>
            dashboardOrpc.sites.branches.discardDeletedDrafts.call({
              ...scope,
              branch: deleted,
            })
          )
        );
      } else {
        await dashboardOrpc.sites.branches.delete.call(scope);
        if (action.branch === branch) {
          await onSwitch(props.productionBranch);
        }
      }
    },
    onSuccess: async () => {
      onClose();
      await invalidate();
    },
    onError,
  });
  const review = useMutation({
    mutationFn: async (merge: boolean) => {
      await onFlush();
      const scope = {
        organizationId,
        siteId,
        branch: branch ?? props.productionBranch,
      };
      if (merge) {
        const result =
          await dashboardOrpc.sites.branches.mergeAndPublish.call(scope);
        await onSwitch(result.branch);
        window.dispatchEvent(new Event(SITE_PUBLISHED_EVENT));
        if (result.deployPending) {
          toast.success(t("deployPending"));
        }
      } else {
        await dashboardOrpc.sites.branches.requestReview.call(scope);
      }
    },
    onSuccess: invalidate,
    onError,
  });
  return { create, edit, review };
}
