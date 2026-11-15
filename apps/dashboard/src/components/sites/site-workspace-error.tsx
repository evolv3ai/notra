"use client";

import {
  AlertCircleIcon,
  ArrowUpRight01Icon,
  FileCorruptIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { useSite } from "@/components/sites/site-context";
import { useSiteWorkspaceLoad } from "@/components/sites/site-workspace-context";
import type { SiteWorkspaceErrorStateProps } from "@/types/components/sites";
import { githubRepositoryUrl, siteHref } from "@/utils/site-links";

function WorkspaceErrorState({
  icon,
  title,
  description,
  children,
}: SiteWorkspaceErrorStateProps) {
  return (
    <Empty className="mx-auto w-full max-w-3xl" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      </EmptyContent>
    </Empty>
  );
}

function OpenOnGitHub() {
  const t = useTranslations("sites.settings");
  const { detail } = useSite();
  const { repository } = detail.site;
  if (!repository) {
    return null;
  }
  return (
    <a
      className={buttonVariants({ size: "sm", variant: "ghost" })}
      href={githubRepositoryUrl(repository)}
      rel="noopener noreferrer"
      target="_blank"
    >
      {t("openOnGitHub")}
      <HugeiconsIcon
        aria-hidden="true"
        data-icon="inline-end"
        icon={ArrowUpRight01Icon}
      />
    </a>
  );
}

/** blog.json or the drafts could not be fetched; offers a retry in place of the page. */
export function SiteWorkspaceLoadError() {
  const t = useTranslations("sites.design");
  const load = useSiteWorkspaceLoad();
  return (
    <WorkspaceErrorState
      description={t("errors.loadDescription")}
      icon={AlertCircleIcon}
      title={t("errors.loadTitle")}
    >
      <Button
        loading={load.retrying}
        onClick={load.retry}
        size="sm"
        variant="outline"
      >
        {t("workspace.tryAgain")}
      </Button>
      <OpenOnGitHub />
    </WorkspaceErrorState>
  );
}

/** blog.json exists but is not valid; editing would overwrite it, so point at the repository instead. */
export function SiteConfigMalformed() {
  const t = useTranslations("sites.design");
  const { organizationSlug, siteId, detail } = useSite();
  return (
    <WorkspaceErrorState
      description={t("workspace.malformed")}
      icon={FileCorruptIcon}
      title={t("errors.malformedTitle")}
    >
      <Link
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href={siteHref(
          organizationSlug,
          siteId,
          "settings",
          detail.site.projectId
        )}
      >
        {t("errors.openSettings")}
      </Link>
      <OpenOnGitHub />
    </WorkspaceErrorState>
  );
}
