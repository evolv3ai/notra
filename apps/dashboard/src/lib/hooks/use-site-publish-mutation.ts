import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { SITE_PUBLISHED_EVENT } from "@/constants/sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitePublishDialogProps } from "@/types/components/sites";
import { toErrorMessage } from "@/utils/error-message";
import { publishConflictPaths } from "@/utils/site-drafts";

/** Flushes a pending autosave, publishes, and closes without waiting on refetches. */
export function useSitePublishMutation(props: SitePublishDialogProps) {
  const { organizationId, siteId, branch } = props;
  const t = useTranslations("sites.publish");
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (props.saving) {
        await props.branchControls?.onFlush();
      }
      return await dashboardOrpc.sites.editor.publish.call({
        organizationId,
        siteId,
        branch,
      });
    },
    onSuccess: (result) => {
      // Publishing clears every draft; show that now. The workspace pauses
      // edits until the fresh document arrives.
      client.setQueryData(
        dashboardOrpc.sites.editor.files.queryKey({
          input: { organizationId, siteId, branch },
        }),
        (current) => (current ? { ...current, drafts: [] } : current)
      );
      void client.invalidateQueries({
        queryKey: dashboardOrpc.sites.key(),
        refetchType: "all",
      });
      props.onOpenChange(false);
      props.onPublished();
      window.dispatchEvent(new Event(SITE_PUBLISHED_EVENT));
      toast.success(result.deployPending ? t("deployPending") : t("committed"));
    },
    onError: (error) => {
      const paths = publishConflictPaths(error);
      if (paths && paths.length > 0) {
        props.onConflict(paths);
        return;
      }
      toast.error(toErrorMessage(error, t("failed")));
    },
  });
}
