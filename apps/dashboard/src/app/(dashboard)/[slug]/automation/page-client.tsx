"use client";

import {
  Add01Icon,
  AiBrowserIcon,
  Clock01Icon,
  GithubIcon,
  Task01Icon,
  ZapIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useState } from "react";
import { InstrumentSection } from "ui/card";
import { useTranslations } from "use-intl";

import { AutomationLoadError } from "@/components/automation/automation-load-error";
import { AutomationTemplateGrid } from "@/components/automation/automation-template-gallery";
import { AutomationsTable } from "@/components/automation/automations-table";
import { OnboardingSuggestions } from "@/components/automation/onboarding-suggestions";
import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { PageContainer } from "@/components/layout/container";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  AUTOMATION_TEMPLATES,
  FEATURED_AUTOMATION_TEMPLATE_IDS,
} from "@/constants/automation-templates";
import { useAutomationMutations } from "@/lib/hooks/use-automation-mutations";
import { useAutomationRowName } from "@/lib/hooks/use-automation-row-name";
import { useAutomationRows } from "@/lib/hooks/use-automation-rows";
import { useLatestAutomationRuns } from "@/lib/hooks/use-automation-runs";
import { useOnboardingSuggestions } from "@/lib/hooks/use-onboarding";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { useRouter } from "@/lib/navigation";
import type { AutomationRow } from "@/types/automation/automations";

import { AutomationPageSkeleton } from "./skeleton";

interface PageClientProps {
  organizationSlug: string;
}

export default function PageClient({ organizationSlug }: PageClientProps) {
  const t = useTranslations("automation.page");
  const { getOrganization } = useOrganizationsContext();
  const organizationId = getOrganization(organizationSlug)?.id;
  const { openSettings } = useSettingsModal();
  const router = useRouter();
  const nameOf = useAutomationRowName();
  const { toggle, remove, runNow, sendTest } =
    useAutomationMutations(organizationId);

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<AutomationRow | null>(null);

  useHotkey("C", () => setCreateMenuOpen(true), {
    enabled: !createMenuOpen,
  });

  const {
    rows,
    alerts: alertList,
    alertsReady,
    isPending,
    isError,
    isRefetching,
    refetch,
  } = useAutomationRows(organizationId);
  const latestRuns = useLatestAutomationRuns(organizationId);
  // Hold the sections below the table until suggestions are known, otherwise
  // templates render first and get pushed down when suggestions arrive.
  const suggestionsLoading = useOnboardingSuggestions(
    organizationId ?? ""
  ).isLoading;
  const showSections = !isPending && !suggestionsLoading;
  const lastRuns = new Map(Object.entries(latestRuns.data?.lastRunAt ?? {}));

  const basePath = `/${organizationSlug}/automation`;
  const goToNew = (query = "") => router.push(`${basePath}/new${query}`);
  const featuredTemplates = FEATURED_AUTOMATION_TEMPLATE_IDS.flatMap((id) =>
    AUTOMATION_TEMPLATES.filter((template) => template.id === id)
  );

  const busyId =
    (toggle.isPending ? toggle.variables?.row.id : undefined) ??
    (remove.isPending ? remove.variables?.id : undefined) ??
    (runNow.isPending ? runNow.variables : undefined) ??
    (sendTest.isPending ? sendTest.variables : undefined);

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-8 px-4 lg:px-6">
        <PageHeading description={t("description")} title={t("title")}>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`${basePath}/runs`}
            >
              <HugeiconsIcon className="size-4" icon={Task01Icon} />
              {t("viewRuns")}
            </Link>
            <DropdownMenu
              onOpenChange={setCreateMenuOpen}
              open={createMenuOpen}
            >
              <DropdownMenuTrigger
                render={
                  <Button className="gap-1.5">
                    <HugeiconsIcon className="size-4" icon={Add01Icon} />
                    {t("create")}
                    <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-64">
                <CreateMenuItem
                  description={t("createMenu.alertHint")}
                  icon={AiBrowserIcon}
                  label={t("createMenu.alert")}
                  onClick={() => goToNew("?type=alert")}
                />
                <CreateMenuItem
                  description={t("createMenu.scheduleHint")}
                  icon={Clock01Icon}
                  label={t("createMenu.schedule")}
                  onClick={() => goToNew("?type=schedule")}
                />
                <CreateMenuItem
                  description={t("createMenu.eventHint")}
                  icon={GithubIcon}
                  label={t("createMenu.event")}
                  onClick={() => goToNew("?type=event")}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PageHeading>

        {isPending ? <AutomationPageSkeleton /> : null}

        {isError ? (
          <AutomationLoadError
            kind="automations"
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}

        {isPending || isError ? null : (
          <AutomationsTable
            busyId={busyId}
            lastRuns={lastRuns}
            emptyState={
              <Empty className="py-0 md:py-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={ZapIcon} />
                  </EmptyMedia>
                  <EmptyTitle>{t("empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("empty.description")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => goToNew()} size="sm">
                    <HugeiconsIcon className="size-4" icon={Add01Icon} />
                    {t("create")}
                  </Button>
                </EmptyContent>
              </Empty>
            }
            onDelete={setDeleteRow}
            onEdit={(row) => router.push(`${basePath}/${row.id}`)}
            onRunNow={(row) => runNow.mutate(row.id)}
            onSendTest={(row) => sendTest.mutate(row.id)}
            onToggle={(row, next) => toggle.mutate({ row, enabled: next })}
            onViewRuns={(row) =>
              router.push(`${basePath}/runs?automation=${row.id}`)
            }
            rows={rows}
          />
        )}

        {showSections ? (
          <>
            {organizationId ? (
              <OnboardingSuggestions
                onCreate={(suggestionId, type) => {
                  const kind =
                    type === "event_automation" ? "event" : "schedule";
                  goToNew(`?type=${kind}&suggestion=${suggestionId}`);
                }}
                organizationId={organizationId}
              />
            ) : null}

            <InstrumentSection
              action={
                <Link
                  className="text-muted-foreground hover:text-foreground duration-fast text-sm transition-colors"
                  href={`${basePath}/templates`}
                >
                  {t("more")}
                </Link>
              }
              eyebrow={t("templatesTitle")}
            >
              <AutomationTemplateGrid
                alerts={alertsReady ? alertList : undefined}
                onOpenWebhooks={() => openSettings("webhooks")}
                organizationSlug={organizationSlug}
                templates={featuredTemplates}
              />
            </InstrumentSection>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel={t("delete")}
        description={t("deleteDescription", {
          name: deleteRow ? nameOf(deleteRow) : "",
        })}
        onConfirm={() => {
          if (deleteRow) {
            remove.mutate(deleteRow, { onSettled: () => setDeleteRow(null) });
          }
        }}
        onOpenChange={(open) => !open && setDeleteRow(null)}
        open={!!deleteRow}
        pending={remove.isPending}
        title={t("deleteTitle")}
        variant="destructive"
      />
    </PageContainer>
  );
}

function CreateMenuItem({
  description,
  icon,
  label,
  onClick,
}: {
  description: string;
  icon: typeof Add01Icon;
  label: string;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem className="items-start gap-2.5 py-2" onClick={onClick}>
      <HugeiconsIcon className="mt-0.5 size-4 shrink-0" icon={icon} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </span>
    </DropdownMenuItem>
  );
}
