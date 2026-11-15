"use client";

import {
  Alert02Icon,
  FilterHorizontalIcon,
  RefreshIcon,
  Rocket01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Label } from "@notra/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useSite } from "@/components/sites/site-context";
import { SiteDeploymentPreviewControls } from "@/components/sites/site-deployment-preview-controls";
import { SiteDeploymentsTable } from "@/components/sites/site-deployments-table";
import { SitePromoteDialog } from "@/components/sites/site-promote-dialog";
import {
  SITE_DEPLOYMENTS_PAGE_SIZE,
  SITE_DEPLOYMENT_ENVIRONMENT_FILTERS,
  SITE_DEPLOYMENT_STATUS_FILTERS,
} from "@/constants/sites";
import { useDeployLatest } from "@/lib/hooks/use-site-deployments";
import { useRouter, useSearchParams } from "@/lib/navigation";
import type {
  SiteDeployment,
  SiteDeploymentEnvironmentFilter,
  SiteDeploymentStatusFilter,
} from "@/types/sites";
import {
  deploymentMatchesFilters,
  deploymentMatchesSearch,
  isDeploymentEnvironmentFilter,
  isDeploymentStatusFilter,
} from "@/utils/site-deployments";
import { siteHref } from "@/utils/site-links";
import { sitePreviewRows } from "@/utils/site-previews";

export function SiteDeploymentsPage() {
  const { organizationId, organizationSlug, siteId, detail } = useSite();
  const t = useTranslations("sites.deploymentsPage");
  const tDetail = useTranslations("sites.detail");
  const tKinds = useTranslations("sites.kinds");
  const tRollback = useTranslations("sites.rollback");
  const tActions = useTranslations("sites.deployments.actions");
  const scope = { organizationId, siteId };
  const deployLatest = useDeployLatest(scope);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const environment = searchParams.get("environment");
  const id = useId();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SiteDeploymentStatusFilter | "all">(
    "all"
  );
  const filters = {
    environment: isDeploymentEnvironmentFilter(environment)
      ? environment
      : "all",
    status,
  };
  const setEnvironment = (value: SiteDeploymentEnvironmentFilter) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all") {
      next.delete("environment");
    } else {
      next.set("environment", value);
    }
    router.replace(
      `${siteHref(organizationSlug, siteId, "deployments")}${next.size ? `?${next}` : ""}`,
      { scroll: false }
    );
  };
  const deployments: SiteDeployment[] = detail.deployments;
  const visible = deployments.filter(
    (deployment) =>
      deploymentMatchesFilters(deployment, filters) &&
      deploymentMatchesSearch(deployment, search)
  );
  const filtered = filters.environment !== "all" || filters.status !== "all";
  const narrowed = filtered || search.trim().length > 0;
  const suspended = detail.site.status === "suspended";

  const environmentLabel = (value: SiteDeploymentEnvironmentFilter) =>
    value === "all" ? t("filters.allEnvironments") : tKinds(value);
  const statusLabel = (value: SiteDeploymentStatusFilter | "all") =>
    value === "all" ? t("filters.allStatuses") : t(`statusFilters.${value}`);

  const deployButton = (variant: "default" | "outline") => (
    <Button
      disabled={suspended}
      loading={deployLatest.isPending}
      onClick={() => deployLatest.mutate()}
      size={variant === "default" ? "default" : "sm"}
      variant={variant}
    >
      <HugeiconsIcon
        aria-hidden="true"
        data-icon="inline-start"
        icon={RefreshIcon}
        strokeWidth={1.5}
      />
      {tDetail("deployLatest")}
    </Button>
  );

  const emptyState = narrowed ? (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{t("noMatches.title")}</EmptyTitle>
        <EmptyDescription>{t("noMatches.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() => {
            setStatus("all");
            setEnvironment("all");
            setSearch("");
          }}
          size="sm"
          variant="outline"
        >
          {t("filters.clear")}
        </Button>
      </EmptyContent>
    </Empty>
  ) : (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Rocket01Icon}
            strokeWidth={1.5}
          />
        </EmptyMedia>
        <EmptyTitle>{t("empty.title")}</EmptyTitle>
        <EmptyDescription>
          {t("empty.description", { branch: detail.site.productionBranch })}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{deployButton("outline")}</EmptyContent>
    </Empty>
  );

  return (
    <>
      <PageHeading
        description={t("description")}
        title={tDetail("tabs.deployments")}
      >
        {deployButton("default")}
      </PageHeading>

      {detail.site.rollbackActive ? (
        <div
          className="border-border bg-background from-background to-muted/60 text-popover-foreground dark:border-input dark:bg-muted dark:from-input dark:to-muted flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-linear-to-b p-3 text-sm shadow-sm [corner-shape:squircle]"
          role="status"
        >
          <div className="flex min-w-0 flex-1 basis-full items-center gap-2.5 sm:basis-auto">
            <span className="bg-warning/12 text-warning flex size-6 shrink-0 items-center justify-center rounded-lg [corner-shape:squircle]">
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3.5"
                icon={Alert02Icon}
                strokeWidth={2}
              />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="leading-snug font-medium">
                {tRollback("pausedTitle")}
              </p>
              <p className="text-muted-foreground text-xs leading-snug">
                {tRollback("pausedDescription")}
              </p>
            </div>
          </div>
          {detail.canUndoRollback ? (
            <Button
              className="ml-8.5 sm:ml-0"
              onClick={() => setPromoteOpen(true)}
              size="sm"
              variant="outline"
            >
              {tActions("undoRollback")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <SitePromoteDialog
        onOpenChange={setPromoteOpen}
        open={promoteOpen}
        organizationId={organizationId}
        siteId={siteId}
      />

      <SiteDeploymentPreviewControls />

      <div
        aria-label={t("filters.label")}
        className="flex items-center justify-between gap-3"
        role="toolbar"
      >
        <InputGroup className="max-w-sm flex-1">
          <InputGroupAddon>
            <HugeiconsIcon aria-hidden="true" icon={Search01Icon} />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("filters.searchLabel")}
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("filters.searchPlaceholder")}
            type="search"
            value={search}
          />
        </InputGroup>
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      aria-label={
                        filtered
                          ? `${t("filters.label")}, ${t("filters.active")}`
                          : t("filters.label")
                      }
                      className="relative shrink-0"
                      size="icon-sm"
                      variant="outline"
                    />
                  }
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={FilterHorizontalIcon}
                size={16}
                strokeWidth={1.5}
              />
              {filtered ? (
                <span
                  aria-hidden="true"
                  className="bg-primary absolute -top-1 -right-1 size-2 rounded-full"
                />
              ) : null}
            </TooltipTrigger>
            <TooltipContent>{t("filters.label")}</TooltipContent>
          </Tooltip>
          <PopoverContent align="end">
            <div className="space-y-4">
              <PopoverTitle>{t("filters.label")}</PopoverTitle>
              <div className="space-y-2">
                <Label htmlFor={`${id}-environment`}>
                  {t("filters.environment")}
                </Label>
                <Select
                  onValueChange={(value: string | null) => {
                    if (isDeploymentEnvironmentFilter(value)) {
                      setEnvironment(value);
                    }
                  }}
                  value={filters.environment}
                >
                  <SelectTrigger
                    aria-label={t("filters.environment")}
                    className="w-full"
                    id={`${id}-environment`}
                  >
                    <SelectValue>
                      {(value: string) =>
                        isDeploymentEnvironmentFilter(value)
                          ? environmentLabel(value)
                          : value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_DEPLOYMENT_ENVIRONMENT_FILTERS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {environmentLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-status`}>{t("filters.status")}</Label>
                <Select
                  onValueChange={(value: string | null) => {
                    if (isDeploymentStatusFilter(value)) {
                      setStatus(value);
                    }
                  }}
                  value={filters.status}
                >
                  <SelectTrigger
                    aria-label={t("filters.status")}
                    className="w-full"
                    id={`${id}-status`}
                  >
                    <SelectValue>
                      {(value: string) =>
                        isDeploymentStatusFilter(value)
                          ? statusLabel(value)
                          : value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_DEPLOYMENT_STATUS_FILTERS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {statusLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {filtered ? (
                <Button
                  onClick={() => {
                    setStatus("all");
                    setEnvironment("all");
                  }}
                  size="sm"
                  variant="outline"
                >
                  {t("filters.clear")}
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <SiteDeploymentsTable
        allDeployments={deployments}
        deployments={visible}
        emptyState={<div className="text-foreground w-full">{emptyState}</div>}
        highlightNewRows
        organizationId={organizationId}
        organizationSlug={organizationSlug}
        pageSize={SITE_DEPLOYMENTS_PAGE_SIZE}
        previewRows={sitePreviewRows(detail)}
        siteId={siteId}
        withActions
      />
    </>
  );
}
