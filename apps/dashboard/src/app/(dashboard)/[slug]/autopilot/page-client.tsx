"use client";

import {
  Analytics01Icon,
  GitPullRequestIcon,
  PlayIcon,
  Settings01Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs, TabsContent } from "@notra/ui/components/ui/tabs";
import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";

import { AutopilotAnalyticsPanel } from "@/components/autopilot/autopilot-analytics-panel";
import { AutopilotAutomationsOverview } from "@/components/autopilot/autopilot-automations-overview";
import { AutopilotFindingConfirmDialog } from "@/components/autopilot/autopilot-finding-confirm-dialog";
import { AutopilotFindingTables } from "@/components/autopilot/autopilot-finding-tables";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import { AutopilotPeriodSelect } from "@/components/autopilot/autopilot-period-select";
import { AutopilotSettingsPanel } from "@/components/autopilot/autopilot-settings-panel";
import { AutopilotSetupFlow } from "@/components/autopilot/autopilot-setup-flow";
import { AutopilotStopButton } from "@/components/autopilot/autopilot-stop-button";
import {
  AutopilotTemplatesPage,
  AutopilotTemplatesSection,
} from "@/components/autopilot/autopilot-templates";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { BackLink } from "@/components/layout/back-link";
import { TabCount } from "@/components/tab-count";
import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATION_SLUGS,
  AUTOPILOT_LINK_ACTIONS,
  AUTOPILOT_PAGE_TABS,
} from "@/constants/autopilot-ui";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import { useRouter } from "@/lib/navigation";
import type {
  AutopilotOverviewPageProps,
  AutopilotPageClientProps,
  AutopilotPendingFindingAction,
} from "@/types/autopilot";
import type { AutopilotMetricsDays } from "@/types/autopilot-metrics";
import {
  autopilotRunKind,
  findActiveAutopilotRun,
} from "@/utils/autopilot-events";
import { isListedPullRequest } from "@/utils/autopilot-findings";

export default function PageClient({
  organizationSlug,
}: AutopilotPageClientProps) {
  return (
    <AutopilotPageShell organizationSlug={organizationSlug}>
      {({ organizationId, overview }) => (
        <AutopilotOverviewPage
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          overview={overview}
        />
      )}
    </AutopilotPageShell>
  );
}

function AutopilotOverviewPage({
  organizationId,
  organizationSlug,
  overview,
}: AutopilotOverviewPageProps) {
  const router = useRouter();
  const { projectId } = useActiveProject();
  const { runNow, setJob, writeSuggestion, merge } =
    useAutopilotActions(organizationId);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(AUTOPILOT_PAGE_TABS)
      .withDefault("automations")
      .withOptions({ clearOnDefault: true })
  );
  const [templatesView, setTemplatesView] = useQueryState(
    "templates",
    parseAsBoolean
  );
  const [days, setDays] = useState<AutopilotMetricsDays>(30);
  const [pending, setPending] = useState<AutopilotPendingFindingAction | null>(
    null
  );
  const [link, setLink] = useQueryStates({
    finding: parseAsString,
    action: parseAsStringLiteral(AUTOPILOT_LINK_ACTIONS),
  });
  const { settings, findings, runs, canManage } = overview;
  const basePath = `/${organizationSlug}${AUTOPILOT_NAV_LINK}`;
  const pullRequests = findings.filter(isListedPullRequest);

  // Slack brief buttons link here with ?finding=…&action=merge|dismiss. The
  // params are dropped once read, so a reload doesn't ask again.
  useEffect(() => {
    if (!(link.finding && link.action)) {
      return;
    }
    const finding = findings.find((row) => row.id === link.finding);
    if (
      canManage &&
      finding &&
      (finding.status === "proposed" ||
        (finding.status === "suggested" && link.action === "dismiss"))
    ) {
      setPending({ kind: link.action, finding });
      void setTab("pull-requests");
    }
    void setLink(null);
  }, [canManage, findings, link, setLink, setTab]);

  const activeRun = findActiveAutopilotRun(runs);
  const isRunning = Boolean(activeRun);

  if (!settings.enabled) {
    return (
      <>
        <PageHeading title="Autopilot" />
        {canManage ? (
          <AutopilotSetupFlow
            callbackPath={basePath}
            onSaved={() => runNow.mutate(undefined)}
            organizationId={organizationId}
            overview={overview}
            projectId={projectId}
            submitLabel="Turn on Autopilot"
          />
        ) : (
          <EmptyState
            description="Ask a workspace admin to turn on Autopilot."
            title="Autopilot is off"
          />
        )}
      </>
    );
  }

  const templateActions = {
    canManage,
    isAdding: setJob.isPending,
    jobs: settings.jobs,
    onAddBuiltIn: (kind: (typeof AUTOPILOT_AUTOMATION_KINDS)[number]) =>
      setJob.mutate({ kind, enabled: true }),
    onOpenBuiltIn: (kind: (typeof AUTOPILOT_AUTOMATION_KINDS)[number]) =>
      router.push(`${basePath}/${AUTOPILOT_AUTOMATION_SLUGS[kind]}`),
  };

  if (templatesView) {
    return (
      <div className="space-y-3">
        <BackLink href={basePath}>Autopilot</BackLink>
        <AutopilotTemplatesPage {...templateActions} />
      </div>
    );
  }

  return (
    <>
      <PageHeading title="Autopilot">
        <div className="flex items-center gap-2">
          {canManage && activeRun?.workflowKey ? (
            <AutopilotStopButton
              organizationId={organizationId}
              runId={activeRun.id}
            />
          ) : null}
          {canManage ? (
            <Button
              disabled={isRunning}
              loading={runNow.isPending || isRunning}
              onClick={() => runNow.mutate(undefined)}
              size="sm"
            >
              <HugeiconsIcon icon={PlayIcon} size={16} />
              Run now
            </Button>
          ) : null}
        </div>
      </PageHeading>

      <Tabs
        onValueChange={(value) => {
          const next = AUTOPILOT_PAGE_TABS.find((option) => option === value);
          void setTab(next ?? "automations");
        }}
        value={tab}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full overflow-x-auto">
            <IconTabsList value={tab}>
              <IconTabsTrigger
                icon={<HugeiconsIcon icon={WorkflowSquare03Icon} size={15} />}
                value="automations"
              >
                Automations
                <TabCount
                  count={
                    AUTOPILOT_AUTOMATION_KINDS.filter(
                      (kind) => settings.jobs[kind]
                    ).length
                  }
                />
              </IconTabsTrigger>
              <IconTabsTrigger
                icon={<HugeiconsIcon icon={GitPullRequestIcon} size={15} />}
                value="pull-requests"
              >
                Pull requests
                <TabCount count={pullRequests.length} />
              </IconTabsTrigger>
              <IconTabsTrigger
                icon={<HugeiconsIcon icon={Analytics01Icon} size={15} />}
                value="analytics"
              >
                Analytics
              </IconTabsTrigger>
              {canManage ? (
                <IconTabsTrigger
                  icon={<HugeiconsIcon icon={Settings01Icon} size={15} />}
                  value="settings"
                >
                  Settings
                </IconTabsTrigger>
              ) : null}
            </IconTabsList>
          </div>
          {tab === "automations" || tab === "analytics" ? (
            <AutopilotPeriodSelect onChange={setDays} value={days} />
          ) : null}
        </div>

        <TabsContent className="mt-4" value="automations">
          <AutopilotAutomationsOverview
            addingKind={
              setJob.isPending && setJob.variables.enabled
                ? setJob.variables.kind
                : null
            }
            canManage={canManage}
            days={days}
            isRunning={runs.some((run) => run.status === "running")}
            jobs={settings.jobs}
            onAddAutomation={(kind) => setJob.mutate({ kind, enabled: true })}
            onOpenAutomation={(kind) =>
              router.push(`${basePath}/${AUTOPILOT_AUTOMATION_SLUGS[kind]}`)
            }
            onRunAutomation={(kind) => runNow.mutate(kind)}
            organizationId={organizationId}
            runDisabled={isRunning || runNow.isPending}
            runningKind={
              runNow.isPending
                ? (runNow.variables ?? null)
                : autopilotRunKind(activeRun)
            }
          />
          <AutopilotTemplatesSection
            {...templateActions}
            onMore={() => {
              void setTemplatesView(true);
            }}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="pull-requests">
          <AutopilotFindingTables
            findings={findings}
            idPrefix="autopilot"
            mergingId={
              merge.isPending ? (merge.variables?.findingId ?? null) : null
            }
            onMerge={(row, method) =>
              merge.mutate({ findingId: row.id, method })
            }
            onOpen={(row) => router.push(`${basePath}/findings/${row.id}`)}
            onWrite={
              settings.enabled
                ? (row) => writeSuggestion.mutate(row.id)
                : undefined
            }
            readOnly={!canManage}
            writingId={
              writeSuggestion.isPending
                ? (writeSuggestion.variables ?? null)
                : null
            }
          />
        </TabsContent>
        <TabsContent className="mt-4" value="analytics">
          <AutopilotAnalyticsPanel
            days={days}
            onSelectRun={(run) => router.push(`${basePath}/runs/${run.id}`)}
            organizationId={organizationId}
            runs={runs}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="settings">
          {canManage ? (
            <AutopilotSettingsPanel
              callbackPath={`${basePath}?tab=settings`}
              organizationId={organizationId}
              overview={overview}
            />
          ) : (
            <EmptyState
              description="Ask a workspace admin to change Autopilot's settings."
              title="Only admins can change this"
            />
          )}
        </TabsContent>
      </Tabs>

      <AutopilotFindingConfirmDialog
        branch={settings.repository?.branch ?? null}
        onClose={() => setPending(null)}
        organizationId={organizationId}
        pending={pending}
      />
    </>
  );
}
