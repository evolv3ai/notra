import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { UseSkillUpdateSyncOptions } from "@/types/hooks/skill-update-sync";

export function useSkillUpdateSync({
  organizationId,
  name,
  reviewedVersion,
  reviewedUpdatedAt,
  onApplied,
  invalidate,
}: UseSkillUpdateSyncOptions) {
  const t = useTranslations("skills.update");

  return useMutation({
    mutationFn: (keepCustomizations: boolean) => {
      if (reviewedVersion === undefined || reviewedUpdatedAt === undefined) {
        throw new Error("Skill update is not loaded");
      }
      return dashboardOrpc.skills.syncSystemSkill.call({
        organizationId,
        name,
        keepCustomizations,
        reviewedVersion,
        reviewedUpdatedAt: new Date(reviewedUpdatedAt),
      });
    },
    onSuccess: (skill, keepCustomizations) => {
      if (!keepCustomizations) {
        onApplied(skill);
      }
      toast.success(
        keepCustomizations
          ? t("kept")
          : t("applied", { version: reviewedVersion ?? 0 })
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => invalidate(),
  });
}
