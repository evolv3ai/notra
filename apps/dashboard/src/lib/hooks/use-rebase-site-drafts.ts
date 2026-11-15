import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { UseRebaseSiteDraftsParams } from "@/types/hooks/sites";
import { toErrorMessage } from "@/utils/error-message";

export function useRebaseSiteDrafts({
  organizationId,
  siteId,
  branch,
  onRebased,
  onSettled,
}: UseRebaseSiteDraftsParams) {
  const t = useTranslations("sites.drafts");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paths: string[]) => {
      const filesOptions = dashboardOrpc.sites.editor.files.queryOptions({
        input: { organizationId, siteId, branch },
      });
      const files = queryClient.getQueryData(filesOptions.queryKey);
      if (!files) {
        throw new Error("Reload the editor files before rebasing");
      }
      const results = await Promise.allSettled(
        paths.map((path) => {
          const draft = files.drafts.find((entry) => entry.path === path);
          return dashboardOrpc.sites.editor.rebaseDraft.call({
            organizationId,
            siteId,
            branch,
            path,
            draftId: draft?.id ?? null,
            draftRevision: draft?.revision ?? null,
            sourceContext: files.sourceContext,
          });
        })
      );
      const readOptions = paths.map((path) =>
        dashboardOrpc.sites.editor.read.queryOptions({
          input: { organizationId, siteId, branch, path },
        })
      );
      await Promise.all(
        [filesOptions, ...readOptions].map(async (options) => {
          const filter = { queryKey: options.queryKey, exact: true };
          await queryClient.cancelQueries(filter);
          await queryClient.resetQueries(filter);
        })
      );
      const refreshed = await Promise.allSettled([
        ...readOptions.map((options) =>
          queryClient.fetchQuery({ ...options, staleTime: Infinity })
        ),
        queryClient.fetchQuery({ ...filesOptions, staleTime: Infinity }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.sites.editor.validate.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.sites.get.key(),
        }),
      ]);
      const failure = [...results, ...refreshed].find(
        (result) => result.status === "rejected"
      );
      onSettled(paths);
      if (failure?.status === "rejected") {
        throw failure.reason;
      }
    },
    onSuccess: () => {
      onRebased();
      toast.success(t("conflict.rebased"));
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, t("conflict.rebaseFailed")));
    },
  });
}
