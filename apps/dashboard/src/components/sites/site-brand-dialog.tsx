"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { useTranslations } from "use-intl";

import { useSite } from "@/components/sites/site-context";
import type {
  SiteBrandDialogProps,
  SiteBrandValueProps,
} from "@/types/site-design";
import { siteAssetUrl } from "@/utils/site-design";

function SiteBrandValue({ change, value }: SiteBrandValueProps) {
  const t = useTranslations("sites.design.brandDialog");
  const { site } = useSite().detail;
  if (!value) {
    return <span className="text-muted-foreground">{t("notSet")}</span>;
  }
  if (change.kind === "color") {
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="ring-foreground/15 size-4 shrink-0 rounded-sm bg-(--swatch) ring-1"
          style={{ "--swatch": value } as React.CSSProperties}
        />
        <span className="font-mono text-xs">{value}</span>
      </span>
    );
  }
  if (change.kind === "image") {
    const src = siteAssetUrl(site.liveUrl, value);
    return (
      <span className="bg-muted/50 ring-foreground/10 inline-flex h-8 max-w-32 min-w-0 items-center rounded-md px-2 ring-1">
        {src ? (
          <img
            alt={t(`fields.${change.field}`)}
            className="max-h-5 max-w-full object-contain"
            src={src}
          />
        ) : (
          <span className="truncate font-mono text-xs">{value}</span>
        )}
      </span>
    );
  }
  return <span className="truncate">{value}</span>;
}

/** Shows what the brand identity would change before it fills the form. */
export function SiteBrandDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
}: SiteBrandDialogProps) {
  const t = useTranslations("sites.design.brandDialog");
  return (
    <ConfirmDialog
      className="sm:max-w-lg"
      confirmLabel={t("confirm")}
      description={t("description")}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={t("title")}
    >
      <div className="border-shell-border bg-shell rounded-xl border p-0.5">
        <dl className="bg-background divide-y overflow-hidden rounded-[10px] border">
          {changes.map((change) => (
            <div
              className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 text-sm"
              key={change.field}
            >
              <dt className="text-muted-foreground">
                {t(`fields.${change.field}`)}
              </dt>
              <dd className="flex min-w-0 items-center gap-2">
                <SiteBrandValue change={change} value={change.from} />
                <HugeiconsIcon
                  aria-label={t("becomes")}
                  className="text-muted-foreground size-3.5 shrink-0"
                  icon={ArrowRight01Icon}
                />
                <SiteBrandValue change={change} value={change.to} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </ConfirmDialog>
  );
}
