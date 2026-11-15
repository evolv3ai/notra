import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteCreateManyInput } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";

export function useCreateSites() {
  const t = useTranslations("sites.new.bulk");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SiteCreateManyInput) =>
      dashboardOrpc.sites.createMany.call(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.sites.list.key(),
      });
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, t("createFailed")));
    },
  });
}
