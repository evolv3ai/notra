"use client";

import { AUTOMATION_RUN_STATUSES } from "@notra/db/constants/automation-runs";
import type { AutomationRunStatus } from "@notra/schemas/dashboard/automation/runs";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { AutomationLoadError } from "@/components/automation/automation-load-error";
import { AutomationRunsTable } from "@/components/automation/runs/automation-runs-table";
import { RunsEmpty } from "@/components/automation/runs/runs-empty";
import { BackLink } from "@/components/layout/back-link";
import { PageContainer } from "@/components/layout/container";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useAutomationRowName } from "@/lib/hooks/use-automation-row-name";
import { useAutomationRows } from "@/lib/hooks/use-automation-rows";
import { useAutomationRuns } from "@/lib/hooks/use-automation-runs";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";

const ALL = "all";

function isRunStatus(value: string | null): value is AutomationRunStatus {
  return (AUTOMATION_RUN_STATUSES as readonly (string | null)[]).includes(
    value
  );
}

interface PageClientProps {
  organizationSlug: string;
}

export default function PageClient({ organizationSlug }: PageClientProps) {
  const t = useTranslations("automation.runs");
  const tEditor = useTranslations("automation.editor");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { getOrganization } = useOrganizationsContext();
  const organizationId = getOrganization(organizationSlug)?.id;
  const nameOf = useAutomationRowName();
  const { rows } = useAutomationRows(organizationId);

  const automationFilter = searchParams.get("automation") ?? ALL;
  const statusParam = searchParams.get("status");
  const statusFilter = isRunStatus(statusParam) ? statusParam : ALL;
  const filtered = automationFilter !== ALL || statusFilter !== ALL;
  const runs = useAutomationRuns(organizationId, {
    ...(automationFilter === ALL ? {} : { automationId: automationFilter }),
    ...(statusFilter === ALL ? {} : { status: statusFilter }),
  });

  const setFilters = (next: { automation?: string; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === ALL) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const automationNames = new Map(rows.map((row) => [row.id, nameOf(row)]));
  const automationItems = {
    [ALL]: t("allAutomations"),
    ...Object.fromEntries(automationNames),
  };
  const statusItems = {
    [ALL]: t("allStatuses"),
    ...Object.fromEntries(
      AUTOMATION_RUN_STATUSES.map((status) => [status, t(`statuses.${status}`)])
    ),
  };

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <div className="space-y-3">
          <BackLink href={`/${organizationSlug}/automation`}>
            {tEditor("back")}
          </BackLink>
          <PageHeading description={t("description")} title={t("title")} />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={automationItems}
              onValueChange={(value) =>
                setFilters({ automation: String(value ?? ALL) })
              }
              value={automationFilter}
            >
              <SelectTrigger
                aria-label={t("filterAutomation")}
                className="max-w-64 min-w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allAutomations")}</SelectItem>
                {rows.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {automationNames.get(row.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={statusItems}
              onValueChange={(value) =>
                setFilters({ status: String(value ?? ALL) })
              }
              value={statusFilter}
            >
              <SelectTrigger
                aria-label={t("filterStatus")}
                className="min-w-36"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
                {AUTOMATION_RUN_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`statuses.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {runs.isPending ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (
            <AutomationRunsTable
              automationNames={automationNames}
              emptyState={
                runs.isError ? (
                  <AutomationLoadError
                    kind="runs"
                    onRetry={() => runs.refetch()}
                    retrying={runs.isFetching}
                  />
                ) : (
                  <RunsEmpty
                    onReset={
                      filtered
                        ? () => setFilters({ automation: ALL, status: ALL })
                        : undefined
                    }
                  />
                )
              }
              loadingMore={runs.isFetchingNextPage}
              onLoadMore={
                runs.hasNextPage ? () => runs.fetchNextPage() : undefined
              }
              organizationSlug={organizationSlug}
              runs={runs.runs}
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
