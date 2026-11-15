"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { TABLE_FRAME_CLASS } from "ui/table/constants";

import { SiteSettingsList } from "@/components/sites/site-settings-item";
import {
  SITE_DEPLOYMENT_LOG_SURFACE_CLASS,
  SITE_DEPLOYMENT_SUMMARY_SURFACE_CLASS,
} from "@/constants/sites";

export function SiteSectionSkeleton() {
  return (
    <div className="space-y-6" data-page-skeleton="">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

const DESIGN_ROW_KEYS = ["a", "b", "c", "d"] as const;

/** Mirrors the Design page: section heading, then setting rows. */
export function SiteDesignSkeleton() {
  return (
    <div aria-busy="true" className="w-full space-y-6" data-page-skeleton="">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <SiteSettingsList>
        {DESIGN_ROW_KEYS.map((key) => (
          <div
            className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b px-4 py-4 sm:grid-cols-[1.25rem_minmax(0,1fr)_15rem] sm:px-5"
            key={key}
          >
            <Skeleton className="size-4.5 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
            <Skeleton className="col-start-2 h-8 w-full rounded-lg sm:col-start-auto" />
          </div>
        ))}
      </SiteSettingsList>
    </div>
  );
}

const SUMMARY_FACT_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

export function SiteDeploymentSkeleton() {
  return (
    <div className="space-y-6" data-page-skeleton="">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>
      <div className={TABLE_FRAME_CLASS}>
        <div className={SITE_DEPLOYMENT_SUMMARY_SURFACE_CLASS}>
          <Skeleton className="aspect-[16/10] w-full rounded-lg" />
          <div className="grid content-center gap-x-8 gap-y-5 sm:grid-cols-2">
            {SUMMARY_FACT_KEYS.map((key) => (
              <div className="space-y-2" key={key}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32 max-w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={TABLE_FRAME_CLASS}>
        <div className={SITE_DEPLOYMENT_LOG_SURFACE_CLASS}>
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
          <div className="border-t p-4">
            <Skeleton className="h-72 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
