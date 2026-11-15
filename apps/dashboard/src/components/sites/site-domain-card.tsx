"use client";

import {
  Alert02Icon,
  ArrowUpRight01Icon,
  Delete02Icon,
  Link04Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteDomainCheckButton } from "@/components/sites/site-domain-check-button";
import {
  SiteDnsRecordsTable,
  SiteDnsSetup,
} from "@/components/sites/site-domain-dns";
import { SiteProxySetup } from "@/components/sites/site-domain-proxy";
import { SITE_DOMAIN_STATUS_BADGES } from "@/constants/sites";
import type {
  SiteDomainCardProps,
  SiteDomainMenuProps,
  SiteDomainStatusBadgeProps,
} from "@/types/components/sites";
import { copyTextToClipboard } from "@/utils/copy-to-clipboard";
import { siteDomainChipStatus, siteDomainUrl } from "@/utils/site-domains";

function SiteDomainStatusBadge({ status }: SiteDomainStatusBadgeProps) {
  const t = useTranslations("sites.domainsPage.status");
  return (
    <StatusBadge
      appearance={SITE_DOMAIN_STATUS_BADGES[status]}
      label={t(status)}
    />
  );
}

function DomainMenu({ hostname, url, canOpen, onRemove }: SiteDomainMenuProps) {
  const t = useTranslations("sites.domainsPage");
  const tCommon = useTranslations("common");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("moreLabel", { hostname })}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <HugeiconsIcon
          className="size-4"
          icon={MoreHorizontalIcon}
          strokeWidth={1.5}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          disabled={!canOpen}
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          <HugeiconsIcon
            icon={ArrowUpRight01Icon}
            size={14}
            strokeWidth={1.5}
          />
          {t("open")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => copyTextToClipboard(url, tCommon("toasts.copied"))}
        >
          <HugeiconsIcon icon={Link04Icon} size={14} strokeWidth={1.5} />
          {t("copyUrl")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRemove} variant="destructive">
          <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.5} />
          {t("remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteDomainCard({
  organizationId,
  siteId,
  domain,
  aliasOrigin,
  mounts,
  onRemove,
}: SiteDomainCardProps) {
  const t = useTranslations("sites.domainsPage");
  const isActive = domain.status === "active";
  const url = siteDomainUrl(domain, mounts);

  let setup = (
    <SiteDnsSetup
      domain={domain}
      organizationId={organizationId}
      siteId={siteId}
    />
  );
  if (domain.kind === "proxy") {
    setup = (
      <SiteProxySetup
        aliasOrigin={aliasOrigin}
        hostname={domain.hostname}
        mounts={mounts}
      />
    );
  } else if (isActive) {
    setup = <SiteDnsRecordsTable records={domain.records} />;
  }
  const checkInHeader = domain.kind === "proxy" || isActive;

  return (
    <TitleCard
      action={
        <>
          {checkInHeader ? (
            <SiteDomainCheckButton
              domain={domain}
              scope={{ organizationId, siteId }}
            />
          ) : null}
          <SiteDomainStatusBadge status={siteDomainChipStatus(domain)} />
          <DomainMenu
            canOpen={isActive}
            hostname={domain.hostname}
            onRemove={() => onRemove(domain)}
            url={url}
          />
        </>
      }
      as="section"
      heading={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate" title={domain.hostname}>
            {domain.hostname}
          </span>
          {domain.isPrimary ? (
            <Badge className="shrink-0" variant="secondary">
              {t("primary")}
            </Badge>
          ) : null}
        </span>
      }
      headingAs="h2"
    >
      <div className="space-y-3 py-1">
        {domain.status === "failed" && domain.lastError ? (
          <p
            className="text-destructive flex items-start gap-2 text-sm"
            role="alert"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
              icon={Alert02Icon}
              strokeWidth={1.5}
            />
            <span className="min-w-0 break-words">
              <span className="font-medium">{t("lastErrorTitle")}</span>{" "}
              {domain.lastError}
            </span>
          </p>
        ) : null}
        {setup}
      </div>
    </TitleCard>
  );
}
