"use client";

import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { useTranslations } from "use-intl";

import { usePromoteDeployment } from "@/lib/hooks/use-site-deployments";
import type { SitePromoteDialogProps } from "@/types/components/sites";

export function SitePromoteDialog({
  organizationId,
  siteId,
  open,
  onOpenChange,
}: SitePromoteDialogProps) {
  const t = useTranslations("sites.rollback");
  const promote = usePromoteDeployment({ organizationId, siteId });

  return (
    <ConfirmDialog
      confirmLabel={t("promoteConfirm")}
      description={t("promoteDescription")}
      onConfirm={() =>
        promote.mutate(undefined, { onSuccess: () => onOpenChange(false) })
      }
      onOpenChange={onOpenChange}
      open={open}
      pending={promote.isPending}
      title={t("promoteTitle")}
    />
  );
}
