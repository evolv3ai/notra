"use client";

import { PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Switch } from "@notra/ui/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AutopilotAutomationFacts } from "@/components/autopilot/autopilot-automation-facts";
import { AutopilotAutomationStatus } from "@/components/autopilot/autopilot-automation-status";
import { AutopilotBackLink } from "@/components/autopilot/autopilot-back-link";
import { AutopilotFindingConfirmDialog } from "@/components/autopilot/autopilot-finding-confirm-dialog";
import { AutopilotFindingTables } from "@/components/autopilot/autopilot-finding-tables";
import { AutopilotJobDecisions } from "@/components/autopilot/autopilot-job-decisions";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import { AutopilotPeriodSelect } from "@/components/autopilot/autopilot-period-select";
import { AutopilotStatStrip } from "@/components/autopilot/autopilot-stat-strip";
import { AutopilotTrend } from "@/components/autopilot/autopilot-trend";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import {
  AUTOPILOT_FROM_PARAM,
  AUTOPILOT_NAV_LINK,
} from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATION_SLUGS,
  AUTOPILOT_AUTOMATIONS,
} from "@/constants/autopilot-ui";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotAutomationPageClientProps,
  AutopilotAutomationPageProps,
  AutopilotPendingFindingAction,
} from "@/types/autopilot";
import type { AutopilotMetricsDays } from "@/types/autopilot-metrics";
import { automationKindFromSlug } from "@/utils/autopilot-automations";
import {
  autopilotRunKind,
  findActiveAutopilotRun,
} from "@/utils/autopilot-events";

export default function PageClient({
  organizationSlug,
  automation,
}: AutopilotAutomationPageClientProps) {
  const kind = automationKindFromSlug(automation);
  return (
    <AutopilotPageShell organizationSlug={organizationSlug}>
      {({ organizationId, overview }) =>
        kind ? (
          <AutomationPage
            kind={kind}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            overview={overview}
          />
        ) : (
          <>
            <AutopilotBackLink slug={organizationSlug} />
            <EmptyState
              description="There is no automation at this address."
              title="Automation not found"
            />
          </>
        )
      }
    </AutopilotPageShell>
  );
}

function AutomationPage({
  kind,
  organizationId,
  organizationSlug,
  overview,
}: AutopilotAutomationPageProps) {
  const automation = AUTOPILOT_AUTOMATIONS[kind];
  const router = useRouter();
  const { runNow, setJob, writeSuggestion, merge } =
    useAutopilotActions(organizationId);
  const [pending, setPending] = useState<AutopilotPendingFindingAction | null>(
    null
  );
  const [days, setDays] = useState<AutopilotMetricsDays>(30);
  const metricsQuery = useQuery(
    dashboardOrpc.autopilot.metrics.queryOptions({
      input: { organizationId, days },
    })
  );
  const metrics = metricsQuery.data?.automations.find(
    (row) => row.kind === kind
  );
  const previous = metricsQuery.data?.previous.automations.find(
    (row) => row.kind === kind
  );
  const findings = overview.findings.filter((finding) => finding.kind === kind);
  const enabled = overview.settings.jobs[kind];
  const activeRun = findActiveAutopilotRun(overview.runs);
  const stats = [
    {
      label: "Pull requests opened",
      value: metrics?.pullRequests,
      trend: metrics ? (
        <AutopilotTrend
          current={metrics.pullRequests}
          previous={previous?.pullRequests}
        />
      ) : null,
    },
    {
      label: "Merged",
      value: metrics?.merged,
      trend: metrics ? (
        <AutopilotTrend current={metrics.merged} previous={previous?.merged} />
      ) : null,
    },
    {
      label: "Credits per run",
      value: metrics?.creditsPerRun,
      trend: metrics ? (
        <AutopilotTrend
          current={metrics.creditsPerRun}
          higherIsBetter={false}
          previous={previous?.creditsPerRun}
        />
      ) : null,
    },
  ];

  return (
    <>
      <div className="space-y-3">
        <AutopilotBackLink slug={organizationSlug} />
        <PageHeading title={automation.name}>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              {enabled ? "On" : "Off"}
              <Switch
                checked={enabled}
                disabled={!overview.canManage || setJob.isPending}
                onCheckedChange={(checked) =>
                  setJob.mutate({ kind, enabled: checked })
                }
              />
            </label>
            {overview.canManage ? (
              <Button
                disabled={
                  !(enabled && overview.settings.enabled) || Boolean(activeRun)
                }
                loading={
                  runNow.isPending || autopilotRunKind(activeRun) === kind
                }
                onClick={() => runNow.mutate(kind)}
                size="sm"
                variant="outline"
              >
                <HugeiconsIcon icon={PlayIcon} size={16} />
                Run now
              </Button>
            ) : null}
          </div>
        </PageHeading>
      </div>
      <AutopilotAutomationStatus
        kind={kind}
        merging={merge.isPending}
        onMerge={(finding, method) =>
          merge.mutate({ findingId: finding.id, method })
        }
        overview={overview}
      />
      <section aria-labelledby="automation-activity" className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-medium" id="automation-activity">
            Activity
          </h2>
          <AutopilotPeriodSelect onChange={setDays} value={days} />
        </div>
        <AutopilotStatStrip busy={metricsQuery.isPending} stats={stats} />
      </section>
      <AutopilotFindingTables
        findings={findings}
        idPrefix="automation"
        mergingId={
          merge.isPending ? (merge.variables?.findingId ?? null) : null
        }
        onMerge={(row, method) => merge.mutate({ findingId: row.id, method })}
        onOpen={(row) =>
          router.push(
            `/${organizationSlug}${AUTOPILOT_NAV_LINK}/findings/${row.id}?${AUTOPILOT_FROM_PARAM}=${AUTOPILOT_AUTOMATION_SLUGS[kind]}`
          )
        }
        onWrite={
          overview.settings.enabled
            ? (row) => writeSuggestion.mutate(row.id)
            : undefined
        }
        readOnly={!overview.canManage}
        showAutomation={false}
        writingId={
          writeSuggestion.isPending ? (writeSuggestion.variables ?? null) : null
        }
      />
      <AutopilotJobDecisions
        kind={kind}
        organizationId={organizationId}
        organizationSlug={organizationSlug}
      />
      <AutopilotAutomationFacts kind={kind} settings={overview.settings} />
      <AutopilotFindingConfirmDialog
        branch={overview.settings.repository?.branch ?? null}
        onClose={() => setPending(null)}
        organizationId={organizationId}
        pending={pending}
      />
    </>
  );
}
