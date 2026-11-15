"use client";

import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { Badge } from "@notra/ui/components/ui/badge";
import { DetailSheetContent } from "@notra/ui/components/ui/detail-sheet";
import { Progress } from "@notra/ui/components/ui/progress";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { McpRequestStatusBadge } from "@/components/mcp/mcp-request-sheet";
import { useMcpToolDetail } from "@/lib/hooks/use-mcp-analytics";
import type {
  McpNeighborListProps,
  McpToolDetailBodyProps,
  McpToolDetailDataProps,
  McpToolRecoveryProps,
  McpToolSheetProps,
} from "@/types/mcp-analytics";
import { formatBytes, formatMilliseconds } from "@/utils/format";
import { errorRate, failureRecovery } from "@/utils/mcp-analytics";

function McpNeighborList({
  title,
  edgeLabel,
  neighbors,
  onSelectTool,
}: McpNeighborListProps) {
  const t = useTranslations("geo.pages.mcp.toolSheet");
  const total = neighbors.reduce((sum, hop) => sum + hop.calls, 0);
  return (
    <InstrumentSection eyebrow={title}>
      {neighbors.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noCalls")}</p>
      ) : (
        <ul className="space-y-2.5">
          {neighbors.map((hop) => {
            const share = total === 0 ? 0 : (hop.calls / total) * 100;
            return (
              <li className="space-y-1" key={hop.tool || edgeLabel}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  {hop.tool ? (
                    <button
                      className="hover:text-primary min-w-0 truncate text-left font-mono"
                      onClick={() => onSelectTool(hop.tool)}
                      type="button"
                    >
                      {hop.tool}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">{edgeLabel}</span>
                  )}
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {hop.afterFailure > 0 ? (
                      <Badge className="me-2" size="sm" variant="warning">
                        {t("afterFailure", { count: hop.afterFailure })}
                      </Badge>
                    ) : null}
                    {Math.round(share)}%
                  </span>
                </div>
                <Progress aria-label={hop.tool || edgeLabel} value={share} />
              </li>
            );
          })}
        </ul>
      )}
    </InstrumentSection>
  );
}

function McpToolRecovery({ tool, after }: McpToolRecoveryProps) {
  const t = useTranslations("geo.pages.mcp.toolSheet");
  const format = useFormatter();
  const { retries, switches, gaveUp } = failureRecovery(tool, after);
  if (retries === 0 && switches.length === 0 && gaveUp === 0) {
    return null;
  }
  return (
    <div className="bg-warning/10 space-y-1.5 rounded-lg px-3 py-2 text-sm">
      <p className="font-medium">{t("recoveryTitle")}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">{t("retried")}</dt>
        <dd className="tabular-nums">{format.number(retries)}</dd>
        {switches.length > 0 ? (
          <>
            <dt className="text-muted-foreground">{t("switched")}</dt>
            <dd className="min-w-0">
              {switches.map((hop, index) => (
                <span key={hop.tool}>
                  {index > 0 ? ", " : null}
                  <span className="font-mono">{hop.tool}</span>{" "}
                  <span className="text-muted-foreground tabular-nums">
                    ({format.number(hop.afterFailure)})
                  </span>
                </span>
              ))}
            </dd>
          </>
        ) : null}
        {gaveUp > 0 ? (
          <>
            <dt className="text-muted-foreground">{t("gaveUp")}</dt>
            <dd className="tabular-nums">{format.number(gaveUp)}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function McpToolFailures({ data }: McpToolDetailDataProps) {
  const t = useTranslations("geo.pages.mcp");
  const failures = data?.failures ?? [];
  return (
    <InstrumentSection
      eyebrow={t("toolSheet.failures")}
      readout={t("toolSheet.failuresReadout", { count: failures.length })}
    >
      {failures.length > 0 ? (
        <ul className="divide-border divide-y text-sm">
          {failures.map((failure) => (
            <li
              className="flex items-start justify-between gap-3 py-2"
              key={`${failure.message}-${failure.clientName}`}
            >
              <div className="min-w-0 space-y-1">
                <p className="break-words">
                  {failure.message || t("toolSheet.noErrorMessage")}
                </p>
                <p className="text-muted-foreground font-mono text-xs">
                  {failure.clientName || t("fallback.unknownClient")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <McpRequestStatusBadge entry={failure} />
                <span className="tabular-nums">{failure.calls}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("toolSheet.noFailures")}
        </p>
      )}
    </InstrumentSection>
  );
}

function McpToolAudience({ data }: McpToolDetailDataProps) {
  const t = useTranslations("geo.pages.mcp.toolSheet");
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <InstrumentSection eyebrow={t("wanted")} hint={t("wantedHint")}>
        {data?.intents.length ? (
          <ul className="space-y-2 text-sm">
            {data.intents.map((intent) => (
              <li className="flex justify-between gap-3" key={intent.intent}>
                <span className="min-w-0">{intent.intent}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {intent.calls}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t("wantedEmpty")}</p>
        )}
      </InstrumentSection>
      <InstrumentSection eyebrow={t("topUsers")}>
        {data?.users.length ? (
          <ul className="space-y-2 text-sm">
            {data.users.map((user) => (
              <li className="flex justify-between gap-3" key={user.id}>
                <span className="min-w-0 truncate font-mono text-xs leading-5">
                  {user.id}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {user.calls}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t("topUsersEmpty")}</p>
        )}
      </InstrumentSection>
    </div>
  );
}

function McpToolDetailBody({
  data,
  tool,
  onSelectTool,
}: McpToolDetailBodyProps) {
  const t = useTranslations("geo.pages.mcp.toolSheet");
  return (
    <>
      <McpToolRecovery after={data?.after ?? []} tool={tool} />
      <div className="grid gap-6 sm:grid-cols-2">
        <McpNeighborList
          edgeLabel={t("sessionStart")}
          neighbors={data?.before ?? []}
          onSelectTool={onSelectTool}
          title={t("calledBefore")}
        />
        <McpNeighborList
          edgeLabel={t("sessionEnd")}
          neighbors={data?.after ?? []}
          onSelectTool={onSelectTool}
          title={t("calledAfter")}
        />
      </div>
      <McpToolFailures data={data} />
      <McpToolAudience data={data} />
    </>
  );
}

export function McpToolSheet({
  organizationId,
  range,
  tool,
  open,
  onOpenChange,
  onSelectTool,
}: McpToolSheetProps) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("geo.pages.mcp");
  const { data, isPending } = useMcpToolDetail(
    organizationId,
    range,
    tool?.name ?? null
  );
  const stats: [string, string][] = tool
    ? [
        [t("columns.calls"), format.number(tool.calls)],
        [
          t("metrics.errorRate"),
          format.number(errorRate(tool.errors, tool.calls) / 100, {
            style: "percent",
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }),
        ],
        [t("columns.users"), format.number(tool.users)],
        [t("columns.p95"), formatMilliseconds(tool.p95Ms, locale)],
        [t("columns.avgResponse"), formatBytes(tool.avgResponseBytes, locale)],
      ]
    : [];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <DetailSheetContent size="lg">
        {tool ? (
          <>
            <SheetHeader>
              <SheetTitle>
                <span className="me-10 block truncate font-mono">
                  {tool.name}
                </span>
              </SheetTitle>
              <SheetDescription>
                {tool.description || t("toolSheet.noDescription")}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pt-2 pb-6">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {stats.map(([label, value]) => (
                  <div className="space-y-0.5" key={label}>
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {isPending ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : (
                <McpToolDetailBody
                  data={data}
                  onSelectTool={onSelectTool}
                  tool={tool.name}
                />
              )}
            </div>
          </>
        ) : null}
      </DetailSheetContent>
    </Sheet>
  );
}
