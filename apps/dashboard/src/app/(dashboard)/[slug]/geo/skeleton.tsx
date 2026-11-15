"use client";

import { ArrowDown01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_CHANGES_SKELETON_ROWS,
  GEO_VISIBILITY_TABLE_ROWS,
} from "@notra/geo-core/constants/geo";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  PermissionRow,
  PermissionOption,
} from "@notra/ui/components/ui/permission-selector";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { InstrumentModule, InstrumentSection } from "ui/card";
import { DataTableSkeleton } from "ui/table";
import type { DataTableSkeletonColumn } from "ui/table/types";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { PageContainer } from "@/components/layout/container";
import { TABLE_ROW_HEIGHT } from "@/constants/table";

const PROVIDER_ROW_COUNT = 5;
/** Change, engine, prompt, position, competitors. */
const CHANGE_COLUMN_WIDTHS: readonly DataTableSkeletonColumn[] = [
  "14rem",
  { width: "8.5rem", collapsePriority: 1 },
  "1.4fr",
  { width: "14rem", collapsePriority: 2 },
  { width: "1fr", collapsePriority: 3 },
];

export function GeoPageSkeleton() {
  const t = useTranslations("geo.pages.overview");
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const tTrend = useTranslations("geo.mentionTrendCard");
  const tTabs = useTranslations("geo.pages.tabs");
  const tWhatChanged = useTranslations("geo.whatChangedCard");
  return (
    <PageContainer
      aria-busy="true"
      data-page-skeleton
      className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6"
    >
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading description={t("descriptionFallback")} title="GEO">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-[8.625rem] rounded-md" />
            <Button className="w-fit gap-2" disabled size="sm">
              <HugeiconsIcon icon={PlayIcon} size={14} />
              {tGeoShared("runScan")}
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
            </Button>
          </div>
        </PageHeading>
        <div className="flex min-w-0 flex-col">
          <PermissionRow
            className="w-fit shrink-0"
            label={tTabs("label")}
            layout="compact"
            value="visibility"
            disabled
          >
            <PermissionOption value="visibility">
              {tCommon("labels.visibility")}
            </PermissionOption>
            <PermissionOption value="brand-sentiment">
              {tCommon("labels.brandSentiment")}
            </PermissionOption>
            <PermissionOption value="journeys">
              {tCommon("labels.journeys")}
            </PermissionOption>
          </PermissionRow>
          <div className="mt-6 flex flex-col gap-6">
            <div className="grid grid-cols-1 items-stretch gap-4 @min-[44rem]/main:grid-cols-12">
              <InstrumentModule
                className="h-full @min-[44rem]/main:col-span-5"
                eyebrow={tCommon("labels.visibility")}
                variant="table"
              >
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-[1.875rem] w-12" />
                  <div className="flex flex-col gap-1">
                    <div className="flex h-5 items-center justify-between">
                      <Skeleton className="h-3.5 w-16" />
                      <Skeleton className="h-3.5 w-16" />
                    </div>
                    <div className="h-63">
                      {Array.from(
                        { length: PROVIDER_ROW_COUNT },
                        (_, index) => (
                          <div
                            className="border-border/60 flex h-11 items-center gap-3 border-t"
                            key={index}
                          >
                            <Skeleton className="size-3.5" />
                            <Skeleton className="size-4 rounded-full" />
                            <Skeleton className="h-3.5 w-24" />
                            <Skeleton className="ml-auto h-3.5 w-6" />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </InstrumentModule>
              <InstrumentModule
                action={<Skeleton className="h-7 w-[6.5rem] rounded-md" />}
                bodyClassName="flex min-h-0 flex-1 flex-col px-4 pt-1 pb-4"
                className="h-full @min-[44rem]/main:col-span-7"
                eyebrow={tTrend("eyebrow")}
                variant="table"
              >
                <Skeleton className="min-h-64 w-full flex-1 rounded-xl" />
              </InstrumentModule>
            </div>
            <InstrumentSection
              eyebrow={tGeoShared("whatChanged")}
              description={tWhatChanged("subline")}
            >
              <DataTableSkeleton
                columnWidths={CHANGE_COLUMN_WIDTHS}
                rowHeight={TABLE_ROW_HEIGHT}
                rows={GEO_CHANGES_SKELETON_ROWS}
                toolbar={<div className="h-17 @min-[32rem]/instrument:h-11" />}
              />
            </InstrumentSection>
            <InstrumentSection
              action={<Skeleton className="h-7 w-full sm:w-56" />}
              eyebrow={tGeoShared("engines")}
            >
              <DataTableSkeleton rows={GEO_VISIBILITY_TABLE_ROWS} />
            </InstrumentSection>
            <div className="grid grid-cols-1 gap-4 @min-[44rem]/main:grid-cols-2">
              <InstrumentSection eyebrow={tGeoShared("shareOfVoice")}>
                <DataTableSkeleton rows={GEO_VISIBILITY_TABLE_ROWS} />
              </InstrumentSection>
              <InstrumentSection eyebrow={tGeoShared("performanceByLanguage")}>
                <DataTableSkeleton rows={GEO_VISIBILITY_TABLE_ROWS} />
              </InstrumentSection>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
