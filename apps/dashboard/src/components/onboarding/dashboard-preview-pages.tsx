"use client";

import { PROMPTS_TABLE_ROW_HEIGHT } from "@notra/geo-core/constants/geo";
import { CompetitorLogo } from "@notra/ui/components/geo/competitor-logo";
import { GeoBar } from "@notra/ui/components/geo/geo-bar";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { DataTable } from "ui/table";
import { useTranslations } from "use-intl";

import { PromptPresenceBadge } from "@/components/geo/prompt-badges";
import { PageContainer } from "@/components/layout/container";
import {
  ONBOARDING_PREVIEW_SKELETON_CARDS,
  ONBOARDING_PREVIEW_SKELETON_ROW_WIDTHS,
  ONBOARDING_PREVIEW_SKELETON_TABS,
} from "@/constants/onboarding";
import { cn } from "@/lib/utils";
import type {
  OnboardingPreviewCompetitorsPageProps,
  OnboardingPreviewOverviewPageProps,
  OnboardingPreviewPromptsPageProps,
  OnboardingPreviewSkeletonChipProps,
} from "@/types/onboarding";
import { onboardingPreviewTableHeight } from "@/utils/onboarding";

function OnboardingPreviewSkeletonChip({
  className,
}: OnboardingPreviewSkeletonChipProps) {
  return (
    <span className="bg-muted/40 flex h-8 items-center rounded-lg border px-3">
      <span
        className={cn(
          "bg-muted-foreground/15 block h-2 rounded-full",
          className
        )}
      />
    </span>
  );
}

function OnboardingPreviewSkeletonText() {
  return (
    <span className="flex flex-col gap-2 pt-1.5">
      <span className="bg-muted-foreground/15 block h-2 w-72 rounded-full" />
      <span className="bg-muted-foreground/15 block h-2 w-44 rounded-full" />
    </span>
  );
}

export function OnboardingPreviewOverviewPage({
  companyName,
}: OnboardingPreviewOverviewPageProps) {
  const t = useTranslations("geo.pages.overview");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <header className="space-y-1" data-zoom="brand">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight">GEO</h1>
            <OnboardingPreviewSkeletonChip className="w-24" />
          </div>
          <p className="text-muted-foreground">
            {t("description", { companyName })}
          </p>
        </header>
        <div className="flex gap-2">
          {ONBOARDING_PREVIEW_SKELETON_TABS.map((width) => (
            <OnboardingPreviewSkeletonChip className={width} key={width} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-4">
          {ONBOARDING_PREVIEW_SKELETON_CARDS.map((card) => (
            <div
              className={cn("rounded-xl border p-4", card.span)}
              key={card.span}
            >
              <span className="bg-muted-foreground/15 block h-2.5 w-24 rounded-full" />
              <div className="mt-5 space-y-4">
                {ONBOARDING_PREVIEW_SKELETON_ROW_WIDTHS.map((width) => (
                  <div className="flex items-center gap-3" key={width}>
                    <span className="bg-muted-foreground/15 size-5 shrink-0 rounded-full" />
                    <span
                      className={cn(
                        "bg-muted-foreground/15 block h-2 rounded-full",
                        width
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

export function OnboardingPreviewPromptsPage({
  prompts,
}: OnboardingPreviewPromptsPageProps) {
  const tTable = useTranslations("geo.promptsTable");
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={<OnboardingPreviewSkeletonText />}
          title={tCommon("labels.prompts")}
        >
          <OnboardingPreviewSkeletonChip className="w-24" />
        </PageHeading>
        <div>
          <DataTable
            columns={[
              {
                key: "prompt",
                header: (
                  <span className="inline-flex items-center gap-1.5">
                    {tGeoShared("prompt")}
                    <span className="text-muted-foreground font-normal tabular-nums">
                      ({prompts.length})
                    </span>
                  </span>
                ),
                width: "1fr",
                minWidth: "10rem",
                cell: (prompt) => (
                  <span className="truncate font-medium">{prompt}</span>
                ),
              },
              {
                key: "mentionedInstead",
                header: tTable("columns.mentionedInstead"),
                width: "12rem",
                cell: () => <PromptPresenceBadge status={null} />,
              },
              {
                key: "presence",
                header: tTable("columns.presence"),
                width: "8rem",
                cell: () => <PromptPresenceBadge status={null} />,
              },
            ]}
            data={prompts}
            emptyState={tGeoShared("scanningEngines")}
            getRowId={(prompt) => prompt}
            height={onboardingPreviewTableHeight(prompts.length)}
            rowHeight={PROMPTS_TABLE_ROW_HEIGHT}
          />
        </div>
      </div>
    </PageContainer>
  );
}

export function OnboardingPreviewCompetitorsPage({
  competitors,
}: OnboardingPreviewCompetitorsPageProps) {
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={<OnboardingPreviewSkeletonText />}
          title={tCommon("labels.competitors")}
        />
        <div>
          <DataTable
            columns={[
              {
                key: "name",
                header: tCommon("labels.brand"),
                width: "1fr",
                minWidth: "10rem",
                cell: (competitor) => (
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CompetitorLogo
                      domain={competitor.domain}
                      name={competitor.name}
                    />
                    <span className="truncate font-medium">
                      {competitor.name}
                    </span>
                    {competitor.domain ? (
                      <span className="text-muted-foreground truncate text-xs">
                        {competitor.domain}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "share",
                header: tGeoShared("shareOfVoice"),
                width: "10rem",
                cell: () => <GeoBar className="w-20" value={0} />,
              },
            ]}
            data={competitors}
            emptyState={tGeoShared("scanningEngines")}
            getRowId={(competitor) => competitor.id}
            height={onboardingPreviewTableHeight(competitors.length)}
            rowHeight={PROMPTS_TABLE_ROW_HEIGHT}
          />
        </div>
      </div>
    </PageContainer>
  );
}
