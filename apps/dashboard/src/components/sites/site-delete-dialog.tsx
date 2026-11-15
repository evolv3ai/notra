"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import { Input } from "@notra/ui/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useInvalidateSites } from "@/lib/hooks/use-sites";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteDeleteDialogProps } from "@/types/components/sites";
import { toastCopyError } from "@/utils/copy-to-clipboard";
import { toErrorMessage } from "@/utils/error-message";

export function SiteDeleteDialog({
  organizationId,
  organizationSlug,
  siteId,
  siteName,
  open,
  onOpenChange,
}: SiteDeleteDialogProps) {
  const t = useTranslations("sites.settings.delete");
  const tCommon = useTranslations("common");
  const id = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateSites = useInvalidateSites();
  const [confirmation, setConfirmation] = useState("");
  const matches = confirmation.trim() === siteName;

  const deleteMutation = useMutation({
    mutationFn: () =>
      dashboardOrpc.sites.delete.call({ organizationId, siteId }),
    onSuccess: async () => {
      toast.success(t("done", { name: siteName }));
      onOpenChange(false);
      queryClient.removeQueries({ queryKey: dashboardOrpc.sites.list.key() });
      router.push(`/${organizationSlug}/sites`);
      await invalidateSites();
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, t("failed")));
    },
  });

  return (
    <ResponsiveDialog
      onOpenChange={(next) => {
        if (!next) {
          setConfirmation("");
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-2"
          id={`${id}-form`}
          onSubmit={(event) => {
            event.preventDefault();
            if (matches && !deleteMutation.isPending) {
              deleteMutation.mutate();
            }
          }}
        >
          <div
            className="flex items-center gap-2 text-sm leading-none font-medium"
            id={`${id}-confirm-label`}
          >
            {t.rich("confirmLabel", {
              name: siteName,
              code: (chunks) => (
                <CopyButton
                  aria-label={`${tCommon("actions.copy")}: ${siteName}`}
                  disabled={deleteMutation.isPending}
                  onCopyError={toastCopyError}
                  size="xs"
                  title={tCommon("actions.copy")}
                  value={siteName}
                >
                  <span className="font-mono font-semibold">{chunks}</span>
                </CopyButton>
              ),
            })}
          </div>
          <Input
            aria-label={t.markup("confirmLabel", {
              name: siteName,
              code: (chunks) => chunks,
            })}
            autoComplete="off"
            id={`${id}-confirm`}
            onChange={(event) => setConfirmation(event.target.value)}
            spellCheck={false}
            value={confirmation}
          />
        </form>
        <ResponsiveDialogFooter>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            {tCommon("actions.cancel")}
          </Button>
          <Button
            disabled={!matches}
            form={`${id}-form`}
            loading={deleteMutation.isPending}
            type="submit"
            variant="destructive"
          >
            {t("confirm")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
