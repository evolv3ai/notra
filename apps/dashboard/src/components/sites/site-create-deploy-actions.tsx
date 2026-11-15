"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import type { SiteCreateDeployActionsProps } from "@/types/components/sites";

export function SiteCreateDeployActions({
  phase,
  settingsHref,
  overviewHref,
  liveUrl,
  isReloadingStatus,
  onReloadStatus,
  isRetrying,
  onRetry,
}: SiteCreateDeployActionsProps) {
  const t = useTranslations("sites.new.deploy");
  if (phase === "ready") {
    return (
      <>
        <a
          className={buttonVariants({ variant: "outline", size: "sm" })}
          href={liveUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t("visit")}
          <HugeiconsIcon data-icon="inline-end" icon={ArrowUpRight01Icon} />
        </a>
        <Link className={buttonVariants({ size: "sm" })} href={overviewHref}>
          {t("openSite")}
        </Link>
      </>
    );
  }
  return (
    <>
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-8 items-center rounded-md text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        href={settingsHref}
      >
        {t("editConfiguration")}
      </Link>
      {phase === "lookupFailed" ? (
        <Button
          loading={isReloadingStatus}
          onClick={onReloadStatus}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("retryStatus")}
        </Button>
      ) : null}
      {phase === "failed" ? (
        <Button
          loading={isRetrying}
          onClick={onRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("retryDeployment")}
        </Button>
      ) : null}
    </>
  );
}
