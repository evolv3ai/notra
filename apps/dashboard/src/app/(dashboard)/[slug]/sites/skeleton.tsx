"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { SitesPageShell } from "@/components/sites/sites-page-shell";
import { SITES_PAGE_SKELETON_ROWS } from "@/constants/sites";

export function SitesPageSkeleton() {
  const t = useTranslations("sites");
  return (
    <SitesPageShell>
      <PageHeading description={t("description")} title={t("title")}>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </PageHeading>
      <div className="space-y-3">
        {Array.from({ length: SITES_PAGE_SKELETON_ROWS }, (_, index) => (
          <div
            className="border-shell-border bg-shell overflow-hidden rounded-2xl border px-0.5 pt-0.5"
            key={index}
          >
            <div className="border-table-card-border bg-table-card shadow-table-card flex items-center rounded-[14px] border px-4 py-3">
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-3.5 py-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-32 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </SitesPageShell>
  );
}
