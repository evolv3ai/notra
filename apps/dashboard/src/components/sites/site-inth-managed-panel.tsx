"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import {
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/button";
import { InthIcon } from "@/components/icons/inth-icon";
import { SiteInthProjectSettings } from "@/components/sites/site-inth-project-settings";
import type { SiteInthManagedPanelProps } from "@/types/components/sites";
import { toErrorMessage } from "@/utils/error-message";

export function SiteInthManagedPanel({
  inth,
  authorizeHref,
}: SiteInthManagedPanelProps) {
  const t = useTranslations("sites.integrationsPage.consent");
  const { status } = inth;

  if (status.isError) {
    return (
      <p className="text-destructive text-sm">
        {toErrorMessage(status.error, t("loadFailed"))}
      </p>
    );
  }
  if (!status.data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-56 max-w-full" />
        <Skeleton className="h-9 w-40" />
      </div>
    );
  }
  if (!status.data.connected) {
    const available = status.data.configured;
    return (
      <div className="bg-muted/15 flex h-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-8 text-center">
        <EmptyMedia className="overflow-hidden" variant="icon">
          <InthIcon className="size-full" />
        </EmptyMedia>
        <div className="max-w-sm">
          <EmptyTitle>{t("connectTitle")}</EmptyTitle>
          <EmptyDescription>
            {available ? t("managedDescription") : t("notConfigured")}
          </EmptyDescription>
        </div>
        {available ? (
          <a className={buttonVariants({ size: "sm" })} href={authorizeHref}>
            {t("connect")}
          </a>
        ) : null}
      </div>
    );
  }
  if (status.data.reauthRequired) {
    return (
      <Alert variant="warning">
        <HugeiconsIcon
          aria-hidden="true"
          icon={Alert02Icon}
          strokeWidth={1.5}
        />
        <AlertTitle>{t("reauthTitle")}</AlertTitle>
        <AlertDescription>
          <p>{t("reauthDescription")}</p>
          <a
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={authorizeHref}
          >
            {t("reconnect")}
          </a>
        </AlertDescription>
      </Alert>
    );
  }
  return <SiteInthProjectSettings inth={inth} status={status.data} />;
}
