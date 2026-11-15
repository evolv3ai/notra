import { useQuery } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutomationRow } from "@/types/automation/automations";

function createdAt(row: AutomationRow) {
  return row.kind === "alert" ? row.alert.createdAt : row.trigger.createdAt;
}

/** Alerts, schedules and event triggers as one list, newest first. */
export function useAutomationRows(organizationId: string | undefined) {
  const input = { organizationId: organizationId ?? "" };
  const enabled = !!organizationId;
  const schedules = useQuery(
    dashboardOrpc.automation.schedules.list.queryOptions({ input, enabled })
  );
  const events = useQuery(
    dashboardOrpc.automation.events.list.queryOptions({ input, enabled })
  );
  const alerts = useQuery(
    dashboardOrpc.automation.alerts.list.queryOptions({ input, enabled })
  );
  const alertList = alerts.data?.alerts ?? [];
  const rows: AutomationRow[] = [
    ...alertList.map((alert) => ({
      kind: "alert" as const,
      id: alert.id,
      alert,
    })),
    ...(schedules.data?.triggers ?? [])
      .filter((trigger) => trigger.sourceType === "cron")
      .map((trigger) => ({
        kind: "schedule" as const,
        id: trigger.id,
        trigger,
      })),
    ...(events.data?.triggers ?? []).map((trigger) => ({
      kind: "event" as const,
      id: trigger.id,
      trigger,
    })),
  ].sort((left, right) => createdAt(right).localeCompare(createdAt(left)));

  const queries = [schedules, events, alerts];
  return {
    rows,
    alerts: alertList,
    /** Alerts loaded, so templates can tell which ones already run. */
    alertsReady: alerts.isSuccess,
    isPending: queries.some((query) => query.isPending),
    /** A list failed, so `rows` is incomplete. */
    isError: queries.some((query) => query.isError),
    isRefetching: queries.some((query) => query.isFetching),
    refetch: () =>
      Promise.all(
        queries.filter((query) => query.isError).map((query) => query.refetch())
      ),
  };
}
