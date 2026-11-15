"use client";

import { GEO_PERSONA_MAX_COUNT } from "@notra/geo-core/constants/geo-personas";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { DataTableSkeleton } from "ui/table";
import { useTranslations } from "use-intl";

import { PersonaActivityCardSkeleton } from "@/components/geo/persona-activity-skeleton";
import { PageContainer } from "@/components/layout/container";
import { GEO_PERSONA_SKELETON_ROW_COUNT } from "@/constants/geo-personas";

export function GeoPersonasSkeleton() {
  const t = useTranslations("geo.pages.personas");
  const tCommon = useTranslations("common");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.personas")}
        >
          <Skeleton className="h-7 w-32 rounded-md" />
        </PageHeading>
        <PersonaActivityCardSkeleton count={GEO_PERSONA_MAX_COUNT} />
        <DataTableSkeleton rows={GEO_PERSONA_SKELETON_ROW_COUNT} />
      </div>
    </PageContainer>
  );
}
