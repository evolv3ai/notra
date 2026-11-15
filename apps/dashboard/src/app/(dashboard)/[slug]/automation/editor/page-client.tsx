"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { GeoAlertForm } from "@/components/automation/alerts/geo-alert-form";
import { AutomationLoadError } from "@/components/automation/automation-load-error";
import {
  type AutomationFormKind,
  TriggerKindPicker,
} from "@/components/automation/editor/editor-parts";
import { EventTriggerForm } from "@/components/automation/events/event-trigger-form";
import { AutomationRunsTable } from "@/components/automation/runs/automation-runs-table";
import { RunsEmpty } from "@/components/automation/runs/runs-empty";
import { ScheduleForm } from "@/components/automation/schedules/schedule-form";
import { BackLink } from "@/components/layout/back-link";
import { PageContainer } from "@/components/layout/container";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { AUTOMATION_TEMPLATES } from "@/constants/automation-templates";
import { useAutomationQueries } from "@/lib/hooks/use-automation-mutations";
import { useAutomationRuns } from "@/lib/hooks/use-automation-runs";
import {
  useDismissOnboardingSuggestion,
  useOnboardingSuggestions,
} from "@/lib/hooks/use-onboarding";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutomationTemplate } from "@/types/automation/automations";
import {
  eventPresetFromSuggestion,
  scheduleValuesFromSuggestion,
} from "@/utils/onboarding-suggestions";

function isFormKind(value: string | null): value is AutomationFormKind {
  return value === "alert" || value === "schedule" || value === "event";
}

interface PageClientProps {
  organizationSlug: string;
  /** Set when editing an existing automation. */
  triggerId?: string;
}

export default function PageClient({
  organizationSlug,
  triggerId,
}: PageClientProps) {
  const t = useTranslations("automation.editor");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getOrganization } = useOrganizationsContext();
  const organizationId = getOrganization(organizationSlug)?.id;
  const { invalidate } = useAutomationQueries(organizationId);
  const { mutate: dismissSuggestion } = useDismissOnboardingSuggestion();
  const suggestionId = searchParams.get("suggestion");
  const suggestions = useOnboardingSuggestions(
    suggestionId ? (organizationId ?? "") : ""
  );
  const suggestion = suggestionId
    ? suggestions.data?.find((item) => item.id === suggestionId)
    : undefined;
  // Memoized so the schedule form doesn't reset on every render.
  const suggestionScheduleValues = useMemo(
    () => (suggestion ? scheduleValuesFromSuggestion(suggestion) : undefined),
    [suggestion]
  );
  const suggestionEventPreset = useMemo(
    () => (suggestion ? eventPresetFromSuggestion(suggestion) : null),
    [suggestion]
  );

  const template: AutomationTemplate | undefined = AUTOMATION_TEMPLATES.find(
    (item) => item.id === searchParams.get("template")
  );
  const typeParam = searchParams.get("type");
  const [pickedKind, setPickedKind] = useState<AutomationFormKind | null>(null);
  const [tab, setTab] = useState<"settings" | "runs">(
    searchParams.get("tab") === "runs" ? "runs" : "settings"
  );
  const runs = useAutomationRuns(
    tab === "runs" ? organizationId : undefined,
    triggerId ? { automationId: triggerId } : {}
  );

  const input = { organizationId: organizationId ?? "" };
  const enabled = !!organizationId && !!triggerId;
  const schedules = useQuery(
    dashboardOrpc.automation.schedules.list.queryOptions({ input, enabled })
  );
  const events = useQuery(
    dashboardOrpc.automation.events.list.queryOptions({ input, enabled })
  );
  const alerts = useQuery(
    dashboardOrpc.automation.alerts.list.queryOptions({ input, enabled })
  );

  const backHref = `/${organizationSlug}/automation`;
  // After a save, wait for the lists to refresh so the page we land on
  // doesn't flash its old (possibly empty) state.
  const refreshed = useRef<Promise<unknown> | undefined>(undefined);
  const stayAfterSave = useRef(false);
  const close = async () => {
    if (stayAfterSave.current) {
      stayAfterSave.current = false;
      return;
    }
    await refreshed.current;
    router.push(backHref);
  };
  const onSaved = () => {
    refreshed.current = invalidate();
    stayAfterSave.current = !!triggerId;
    if (organizationId && suggestionId) {
      dismissSuggestion({ organizationId, suggestionId });
    }
  };

  const editAlert = alerts.data?.alerts.find((item) => item.id === triggerId);
  const editSchedule = schedules.data?.triggers.find(
    (item) => item.id === triggerId && item.sourceType === "cron"
  );
  const editEvent = events.data?.triggers.find((item) => item.id === triggerId);

  let kind: AutomationFormKind;
  if (triggerId) {
    kind = editAlert ? "alert" : editSchedule ? "schedule" : "event";
  } else {
    kind =
      pickedKind ??
      (template && template.kind !== "webhooks" ? template.kind : null) ??
      (isFormKind(typeParam) ? typeParam : "alert");
  }

  const editLoading =
    (!!triggerId &&
      (schedules.isPending || events.isPending || alerts.isPending)) ||
    (!!suggestionId && suggestions.isPending);
  const editMissing =
    !!triggerId && !editLoading && !(editAlert || editSchedule || editEvent);

  const kindPicker = triggerId ? undefined : (
    <TriggerKindPicker kind={kind} onSelect={setPickedKind} />
  );

  let form: React.ReactNode = null;
  if (organizationId && !editLoading && !editMissing) {
    if (kind === "alert") {
      form = (
        <GeoAlertForm
          kindPicker={kindPicker}
          editAlert={editAlert ?? null}
          key={`alert-${triggerId ?? template?.id ?? "new"}`}
          onOpenChange={(open) => !open && close()}
          onSaved={onSaved}
          open
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          preset={
            template?.kind === "alert"
              ? {
                  signal: template.signal,
                  ...(template.action === "slack"
                    ? { actions: { slack: true, email: false } }
                    : {}),
                }
              : { signal: "visibility_drop" }
          }
        />
      );
    } else if (kind === "schedule") {
      form = (
        <ScheduleForm
          kindPicker={kindPicker}
          editTrigger={editSchedule}
          key={`schedule-${triggerId ?? template?.id ?? suggestionId ?? "new"}`}
          onOpenChange={(open) => !open && close()}
          onSuccess={onSaved}
          open
          organizationId={organizationId}
          presetId={template?.kind === "schedule" ? template.presetId : null}
          presetValues={suggestionScheduleValues}
        />
      );
    } else {
      form = (
        <EventTriggerForm
          kindPicker={kindPicker}
          editTrigger={editEvent}
          key={`event-${triggerId ?? template?.id ?? suggestionId ?? "new"}`}
          onOpenChange={(open) => !open && close()}
          onSuccess={onSaved}
          open
          organizationId={organizationId}
          preset={
            template?.kind === "event" ? template.preset : suggestionEventPreset
          }
        />
      );
    }
  }

  const runHistory = runs.isPending ? (
    <Skeleton className="h-72 rounded-2xl" />
  ) : (
    <AutomationRunsTable
      emptyState={
        runs.isError ? (
          <AutomationLoadError
            kind="runs"
            onRetry={() => runs.refetch()}
            retrying={runs.isFetching}
          />
        ) : (
          <RunsEmpty />
        )
      }
      loadingMore={runs.isFetchingNextPage}
      onLoadMore={runs.hasNextPage ? () => runs.fetchNextPage() : undefined}
      organizationSlug={organizationSlug}
      runs={runs.runs}
    />
  );

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 lg:px-6">
        <div className="flex min-h-8 items-center justify-between gap-4">
          <BackLink href={backHref}>{t("back")}</BackLink>
          {triggerId && !editMissing ? (
            <Tabs
              onValueChange={(value) => setTab(value as "settings" | "runs")}
              value={tab}
            >
              <TabsList>
                <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
                <TabsTrigger value="runs">{t("tabs.runs")}</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
        </div>

        {editLoading || !organizationId ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : null}
        {editMissing ? (
          <p className="text-muted-foreground text-sm">{t("notFound")}</p>
        ) : null}
        {tab === "runs" && triggerId ? runHistory : form}
      </div>
    </PageContainer>
  );
}
