"use client";

import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PlusSignIcon,
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
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteIntegrationLogo } from "@/components/sites/site-integration-logo";
import { SITE_INTEGRATION_ACTIVE_BADGE } from "@/constants/site-integrations";
import type { SiteIntegrationRowProps } from "@/types/components/sites";

export function SiteIntegrationRow({
  provider,
  description,
  addLabel,
  addAriaLabel,
  isSetUp,
  loading,
  disabled,
  onOpen,
  onRemove,
}: SiteIntegrationRowProps) {
  const t = useTranslations("sites.integrationsPage");
  return (
    <div className="group/integration duration-fast hover:bg-muted/40 relative flex items-center gap-4 border-b px-4 py-4 transition-colors sm:px-5">
      <SiteIntegrationLogo provider={provider} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            className="focus-visible:ring-ring/50 cursor-pointer rounded-sm text-left text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:ring-[3px]"
            onClick={onOpen}
            disabled={disabled}
            type="button"
          >
            {provider.name}
          </button>
          {provider.recommended ? (
            <Badge variant="secondary">{t("recommended")}</Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm text-pretty">
          {description}
        </p>
      </div>
      {loading ? <Skeleton className="h-7 w-16 shrink-0 rounded-md" /> : null}
      {!loading && isSetUp ? (
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge
            appearance={SITE_INTEGRATION_ACTIVE_BADGE}
            label={t("active")}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={t("more", { provider: provider.name })}
                  className="relative cursor-pointer"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                />
              }
            >
              <HugeiconsIcon
                className="size-4"
                icon={MoreHorizontalIcon}
                strokeWidth={1.5}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onOpen}>
                <HugeiconsIcon
                  icon={PencilEdit02Icon}
                  size={14}
                  strokeWidth={1.5}
                />
                {t("edit")}
              </DropdownMenuItem>
              {onRemove ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onRemove} variant="destructive">
                    <HugeiconsIcon
                      icon={Delete02Icon}
                      size={14}
                      strokeWidth={1.5}
                    />
                    {t("remove")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      {loading || isSetUp ? null : (
        <Button
          aria-label={addAriaLabel ?? t("add", { provider: provider.name })}
          className="relative shrink-0 cursor-pointer"
          onClick={onOpen}
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon
            data-icon="inline-start"
            icon={PlusSignIcon}
            strokeWidth={1.75}
          />
          {addLabel ?? t("addShort")}
        </Button>
      )}
    </div>
  );
}
