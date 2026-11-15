"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useLocation } from "@tanstack/react-router";

import {
  SiteDeploymentSkeleton,
  SiteDesignSkeleton,
  SiteSectionSkeleton,
} from "@/components/sites/site-page-skeleton";
import { SitesPageShell } from "@/components/sites/sites-page-shell";
import { SITE_SIDEBAR_SKELETON_GROUPS } from "@/constants/sites";

/** The site bar and sidebar as placeholders, so the loaded frame lands in place. */
export function SitePageSkeleton() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [, , , , section, deploymentId] = pathname.split("/");
  let body = <SiteSectionSkeleton />;
  if (section === "design") {
    body = <SiteDesignSkeleton />;
  } else if (section === "deployments" && deploymentId) {
    body = <SiteDeploymentSkeleton />;
  }
  return (
    <div
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="bg-sidebar flex min-h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-5">
        <Skeleton className="size-4 rounded-sm" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="bg-sidebar hidden w-60 shrink-0 flex-col border-e md:flex">
          <div className="min-h-0 flex-1 py-1">
            {SITE_SIDEBAR_SKELETON_GROUPS.map((rows, group) => (
              <div className="p-2" key={rows.join()}>
                {group > 0 ? (
                  <div className="flex h-8 items-center px-2">
                    <Skeleton className="h-3 w-20" />
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  {rows.map((row) => (
                    <div className="flex h-8 items-center gap-2 px-2" key={row}>
                      <Skeleton className="size-4 rounded-sm" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex h-12 shrink-0 items-center border-t px-4">
            <Skeleton className="h-3.5 w-36" />
          </div>
        </div>
        <div className="scrollbar-stable flex min-h-0 min-w-0 flex-1 scrollbar-thin flex-col overflow-x-hidden overflow-y-auto">
          <div className="bg-sidebar flex shrink-0 gap-1 overflow-hidden border-b p-2 md:hidden">
            {SITE_SIDEBAR_SKELETON_GROUPS[0].map((row) => (
              <div
                className="flex h-8 shrink-0 items-center gap-2 px-2.5"
                key={row}
              >
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
          <SitesPageShell>{body}</SitesPageShell>
        </div>
      </div>
    </div>
  );
}
