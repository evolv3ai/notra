import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@notra/ui/components/ui/alert-dialog";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { GitHubWebhookRepairDialogProps } from "@/types/integrations/github";

export function GitHubWebhookRepairDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  disabled,
  error,
}: GitHubWebhookRepairDialogProps) {
  const t = useTranslations("integrations.github.webhookSettings");
  const tCommon = useTranslations("common");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("repairTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("repairDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error.message}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {tCommon("actions.cancel")}
          </AlertDialogCancel>
          <Button loading={isPending} disabled={disabled} onClick={onConfirm}>
            {error ? tCommon("actions.retry") : t("repair")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
