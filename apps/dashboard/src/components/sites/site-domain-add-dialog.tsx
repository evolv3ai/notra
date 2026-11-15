"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteDomainAddForm } from "@/components/sites/site-domain-add-form";
import type { SiteDomainAddDialogProps } from "@/types/components/sites";

export function SiteDomainAddDialog({
  organizationId,
  siteId,
  mounts,
  open,
  onOpenChange,
}: SiteDomainAddDialogProps) {
  const t = useTranslations("sites.domainsPage.add");
  const tCommon = useTranslations("common");

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <SiteDomainAddForm
          autoFocus
          mounts={mounts}
          onAdded={() => onOpenChange(false)}
          organizationId={organizationId}
          renderActions={({ canSubmit, pending }) => (
            <ResponsiveDialogFooter className="mt-1">
              <Button
                disabled={pending}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                {tCommon("actions.cancel")}
              </Button>
              <Button
                data-dialog-confirm
                disabled={!canSubmit}
                loading={pending}
                type="submit"
              >
                {t("submit")}
              </Button>
            </ResponsiveDialogFooter>
          )}
          siteId={siteId}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
