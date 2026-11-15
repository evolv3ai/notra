"use client";

import { AGENT_READINESS_SKELETON_ROW_KEYS } from "@notra/geo-core/constants/agent-readiness";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { InstrumentModule } from "ui/card";
import { DataTableSkeleton } from "ui/table";
import type { DataTableSkeletonColumn } from "ui/table/types";
import { useTranslations } from "use-intl";

import { PageContainer } from "@/components/layout/container";
import { TABLE_ROW_HEIGHT } from "@/constants/table";

const CHANGE_ROW_COUNT = 4;
/** Change, check, priority, result. */
const CHANGE_COLUMN_WIDTHS: readonly DataTableSkeletonColumn[] = [
  "11rem",
  "1fr",
  { width: "9rem", collapsePriority: 1 },
  { width: "12rem", collapsePriority: 2 },
];

export function AgentReadinessSkeleton() {
  const t = useTranslations("geo.pages.agentReadiness");
  const tReadiness = useTranslations("geo.agentReadiness");
  const tCommon = useTranslations("common");
  const content = (
    <div className="flex flex-col gap-6">
      <InstrumentModule
        action={
          <>
            <Skeleton className="hidden h-3.5 w-64 sm:block" />
            <Skeleton className="h-7 w-[5.25rem] rounded-md" />
          </>
        }
        bodyClassName="gap-0 p-0"
        eyebrow={tReadiness("scoreCard.eyebrow")}
        variant="table"
      >
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-10">
          <div className="flex items-center gap-5">
            <Skeleton className="size-24 rounded-full" />
            <Skeleton className="h-7 w-48" />
          </div>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }, (_, index) => (
              <div className="flex flex-col gap-2" key={index}>
                <div className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3.5 w-36" />
                </div>
                <Skeleton className="h-1.5 rounded-full" />
              </div>
            ))}
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>
        <div className="bg-muted/40 flex items-center gap-3 border-t px-6 py-3">
          <Skeleton className="h-4 flex-1 sm:max-w-md" />
          <Skeleton className="ml-auto h-6 w-36 rounded-md" />
        </div>
      </InstrumentModule>
      <section className="flex min-w-0 flex-col gap-3">
        <div className="space-y-1">
          <h2 className="text-foreground text-sm font-medium">
            {tReadiness("changes.eyebrow")}
          </h2>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
        <DataTableSkeleton
          columnWidths={CHANGE_COLUMN_WIDTHS}
          rowHeight={TABLE_ROW_HEIGHT}
          rows={CHANGE_ROW_COUNT}
        />
      </section>
      <InstrumentModule
        action={<Skeleton className="h-6 w-32 rounded-md" />}
        bodyClassName="gap-0 p-0"
        eyebrow={tReadiness("checklist.eyebrow")}
        variant="table"
      >
        {AGENT_READINESS_SKELETON_ROW_KEYS.map((key) => (
          <div className="border-b px-5 py-3 last:border-b-0" key={key}>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </InstrumentModule>
    </div>
  );

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.agentReadiness")}
        />
        {content}
      </div>
    </PageContainer>
  );
}
