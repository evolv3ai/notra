import type { AutomationRunStatus } from "@notra/schemas/dashboard/automation/runs";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { AUTOMATION_RUNS_POLL_INTERVAL_MS } from "@/constants/automation-runs";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutomationRunsPage } from "@/types/automation/runs";

function hasRunningRun(pages: AutomationRunsPage[] | undefined) {
  return (
    pages?.some((page) => page.runs.some((run) => run.status === "running")) ??
    false
  );
}

/** Runs of every automation, or of one when `automationId` is set, newest first. */
export function useAutomationRuns(
  organizationId: string | undefined,
  filters: { automationId?: string; status?: AutomationRunStatus } = {}
) {
  const query = useInfiniteQuery(
    dashboardOrpc.automation.runs.list.infiniteOptions({
      input: (cursor: string | undefined) => ({
        organizationId: organizationId ?? "",
        ...(filters.automationId ? { automationId: filters.automationId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(cursor ? { cursor } : {}),
      }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: !!organizationId,
      placeholderData: keepPreviousData,
      refetchInterval: (current: {
        state: { data?: { pages: AutomationRunsPage[] } };
      }) =>
        hasRunningRun(current.state.data?.pages)
          ? AUTOMATION_RUNS_POLL_INTERVAL_MS
          : false,
    })
  );
  return {
    ...query,
    runs: query.data?.pages.flatMap((page) => page.runs) ?? [],
  };
}

/** When each automation last ran, by automation ID. */
export function useLatestAutomationRuns(organizationId: string | undefined) {
  return useQuery(
    dashboardOrpc.automation.runs.latest.queryOptions({
      input: { organizationId: organizationId ?? "" },
      enabled: !!organizationId,
    })
  );
}

/** Refreshes run lists after something started a run. */
export function useInvalidateAutomationRuns() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.automation.runs.key(),
    });
}
