"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/layout/container";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useAutopilotOverview } from "@/lib/hooks/use-autopilot";
import type { AutopilotPageShellProps } from "@/types/autopilot";
import { toErrorMessage } from "@/utils/error-message";

/** Loads Autopilot once for every Autopilot page and handles the states before it exists. */
export function AutopilotPageShell({
  organizationSlug,
  children,
}: AutopilotPageShellProps) {
  const { getOrganization } = useOrganizationsContext();
  const organizationId = getOrganization(organizationSlug)?.id ?? "";
  const query = useAutopilotOverview(organizationId);
  const overview = query.data;

  if (!overview && query.isError) {
    return (
      <PageContainer className="flex flex-1 flex-col py-4 md:py-6">
        <div className="w-full px-4 lg:px-6">
          <EmptyState
            actionLabel="Try again"
            description={toErrorMessage(
              query.error,
              "Autopilot could not be loaded."
            )}
            onActionClick={() => query.refetch()}
            title="Something went wrong"
          />
        </div>
      </PageContainer>
    );
  }
  if (!overview) {
    // The page's shape (heading, tabs, a table) so nothing jumps once it loads.
    return (
      <PageContainer className="flex flex-1 flex-col py-4 md:py-6">
        <div
          aria-busy="true"
          aria-label="Loading Autopilot"
          className="w-full space-y-6 px-4 lg:px-6"
          role="status"
        >
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-80 rounded-lg" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </PageContainer>
    );
  }
  if (!overview.available) {
    return (
      <PageContainer className="flex flex-1 flex-col py-4 md:py-6">
        <div className="w-full px-4 lg:px-6">
          <EmptyState
            description="Autopilot isn't available for this workspace yet."
            title="Autopilot"
          />
        </div>
      </PageContainer>
    );
  }
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 has-[[data-autopilot-fill]]:flex has-[[data-autopilot-fill]]:flex-1 has-[[data-autopilot-fill]]:flex-col lg:px-6">
        {children({ organizationId, overview })}
      </div>
    </PageContainer>
  );
}
