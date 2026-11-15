"use client";

import {
  AiChat02Icon,
  Clock01Icon,
  Loading03Icon,
  MinusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GEO_SCAN_RESULTS_PAGE_SIZE } from "@notra/geo-core/constants/geo-scan-history";
import type { GeoScanResultSummary } from "@notra/geo-core/types/geo-scan-history";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { type ReactNode, useState } from "react";
import { InstrumentSection } from "ui/card";
import {
  DataTableSkeleton,
  DataTable,
  type DataTablePagination,
  type TableColumn,
} from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EngineIcon } from "@/components/geo/engine-icon";
import { ScanActivityStatus } from "@/components/geo/scan-activity-status";
import { ScanAnswerSheet } from "@/components/geo/scan-answer-sheet";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useIsGeoScanning } from "@/lib/hooks/use-geo";
import { useGeoScanRun } from "@/lib/hooks/use-geo-scan-history";
import type {
  GeoScanAnswerTableRow,
  GeoScanLiveTableRow,
  GeoScanLiveStatusCellProps,
  GeoScanModelCellProps,
  GeoScanOpenAnswer,
  GeoScanPendingAnswer,
  GeoScanPromptCellProps,
  GeoScanRunAnswersTableProps,
  GeoScanRunDetailProps,
  GeoScanRunDetailState,
  GeoScanRunEmptyProps,
  GeoScanRunLoadedProps,
  GeoScanRunEmptyStateInput,
  GeoScanRunFiltersProps,
  GeoScanRunLiveTableProps,
  GeoScanRunPendingTableProps,
  GeoScanRunView,
  GeoScanViewCountProps,
  ScanRunDetailTranslator,
} from "@/types/geo-scan-activity";
import type { GeoSharedTranslator } from "@/types/geo-shared";
import type { CommonTranslator } from "@/types/i18n";
import { formatEngineFamily } from "@/utils/geo-charts";
import { scanRunDetailView } from "@/utils/geo-scan-activity";

const ALL_MODELS = "";
const SCAN_SKELETON_ROWS = 3;
const INITIAL_SCAN_RUN_STATE: GeoScanRunDetailState = {
  runId: null,
  view: "answers",
  offset: 0,
  pendingOffset: 0,
  engine: ALL_MODELS,
};

function ModelCell({ engine }: GeoScanModelCellProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <EngineIcon className="size-3.5 shrink-0" engine={engine} />
      <TruncateWithTooltip>{formatEngineFamily(engine)}</TruncateWithTooltip>
    </span>
  );
}

function PromptCell({ prompt, turn, repeated }: GeoScanPromptCellProps) {
  const t = useTranslations("geo.scanRunDetail");
  return (
    <span className="flex min-w-0 items-center gap-2">
      <TruncateWithTooltip
        className={repeated ? "text-muted-foreground/60" : "font-medium"}
      >
        {prompt}
      </TruncateWithTooltip>
      {turn === null ? null : (
        <span className="text-muted-foreground shrink-0 text-xs">
          {t("turn", { turn })}
        </span>
      )}
    </span>
  );
}

function mentionCell(
  row: GeoScanResultSummary,
  tShared: GeoSharedTranslator
): ReactNode {
  // Fades in when a live row fills.
  return (
    <span className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
      <StatusBadge
        appearance={
          row.mentioned
            ? { variant: "success", icon: Tick02Icon }
            : { variant: "secondary", icon: MinusSignIcon }
        }
        label={row.mentioned ? tShared("mentioned") : tShared("notMentioned")}
      />
    </span>
  );
}

function positionCell(row: GeoScanResultSummary): ReactNode {
  return (
    <span className="text-muted-foreground motion-safe:animate-in motion-safe:fade-in tabular-nums motion-safe:duration-500">
      {row.position === null ? "–" : `#${row.position}`}
    </span>
  );
}

function sourcesCell(row: GeoScanResultSummary, locale: string): ReactNode {
  return (
    <span className="text-muted-foreground motion-safe:animate-in motion-safe:fade-in tabular-nums motion-safe:duration-500">
      {row.sources.toLocaleString(locale)}
    </span>
  );
}

function LiveStatusCell({ status }: GeoScanLiveStatusCellProps) {
  const t = useTranslations("geo.scanRunDetail");
  if (status === "running") {
    return (
      <span className="text-foreground inline-flex items-center gap-2">
        <HugeiconsIcon
          aria-hidden="true"
          className="text-primary shrink-0 motion-safe:animate-spin"
          icon={Loading03Icon}
          size={14}
        />
        {t("status.running")}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2">
      <HugeiconsIcon
        aria-hidden="true"
        className="shrink-0"
        icon={status === "queued" ? Clock01Icon : MinusSignIcon}
        size={14}
      />
      {status === "queued" ? t("status.queued") : t("status.missing")}
    </span>
  );
}

function liveColumns(
  showLanguage: boolean,
  t: ScanRunDetailTranslator,
  tShared: GeoSharedTranslator,
  tCommon: CommonTranslator,
  locale: string
): TableColumn<GeoScanLiveTableRow>[] {
  return [
    {
      key: "prompt",
      header: tShared("prompt"),
      width: "1fr",
      minWidth: "14rem",
      cell: (row) => (
        <PromptCell
          prompt={row.prompt}
          repeated={row.repeated}
          turn={row.turn ?? null}
        />
      ),
    },
    {
      key: "engine",
      header: tCommon("labels.model"),
      width: "12.5rem",
      cell: (row) => <ModelCell engine={row.engine} />,
    },
    ...(showLanguage
      ? [
          {
            key: "language",
            header: tCommon("labels.language"),
            width: "7rem",
            cell: (row: GeoScanLiveTableRow) => (
              <span className="text-muted-foreground">{row.language}</span>
            ),
          },
        ]
      : []),
    {
      key: "mentioned",
      header: t("columns.mention"),
      width: "11rem",
      cell: (row) =>
        row.answer ? (
          mentionCell(row.answer, tShared)
        ) : (
          <LiveStatusCell status={row.status} />
        ),
    },
    {
      key: "position",
      align: "right",
      header: tCommon("labels.position"),
      width: "6rem",
      cell: (row) => (row.answer ? positionCell(row.answer) : null),
    },
    {
      key: "sources",
      align: "right",
      header: tCommon("labels.sources"),
      width: "6rem",
      cell: (row) => (row.answer ? sourcesCell(row.answer, locale) : null),
    },
  ];
}

function answerColumns(
  showLanguage: boolean,
  t: ScanRunDetailTranslator,
  tShared: GeoSharedTranslator,
  tCommon: CommonTranslator,
  locale: string
): TableColumn<GeoScanAnswerTableRow>[] {
  return [
    {
      key: "prompt",
      header: tShared("prompt"),
      width: "1fr",
      minWidth: "14rem",
      cell: (row) => (
        <PromptCell
          prompt={row.prompt}
          repeated={row.repeated}
          turn={row.sequenceId ? row.turn : null}
        />
      ),
    },
    {
      key: "engine",
      header: tCommon("labels.model"),
      width: "12.5rem",
      cell: (row) => <ModelCell engine={row.engine} />,
    },
    ...(showLanguage
      ? [
          {
            key: "language",
            header: tCommon("labels.language"),
            width: "7rem",
            cell: (row: GeoScanAnswerTableRow) => (
              <span className="text-muted-foreground">{row.language}</span>
            ),
          },
        ]
      : []),
    {
      key: "mentioned",
      header: t("columns.mention"),
      width: "11rem",
      cell: (row) => mentionCell(row, tShared),
    },
    {
      key: "position",
      align: "right",
      header: tCommon("labels.position"),
      width: "6rem",
      cell: positionCell,
    },
    {
      key: "sources",
      align: "right",
      header: tCommon("labels.sources"),
      width: "6rem",
      cell: (row) => sourcesCell(row, locale),
    },
  ];
}

function pendingStatusLabel(
  status: GeoScanPendingAnswer["status"],
  t: ScanRunDetailTranslator,
  tCommon: CommonTranslator
) {
  if (status === "running") {
    return t("status.running");
  }
  if (status === "queued") {
    return tCommon("labels.queued");
  }
  return t("status.missing");
}

function pendingColumns(
  showLanguage: boolean,
  t: ScanRunDetailTranslator,
  tShared: GeoSharedTranslator,
  tCommon: CommonTranslator
): TableColumn<GeoScanPendingAnswer>[] {
  return [
    {
      key: "prompt",
      header: tShared("prompt"),
      width: "1fr",
      minWidth: "14rem",
      cell: (row) => <PromptCell prompt={row.prompt} turn={row.turn ?? null} />,
    },
    {
      key: "engine",
      header: tCommon("labels.model"),
      width: "12.5rem",
      cell: (row) => <ModelCell engine={row.engine} />,
    },
    ...(showLanguage
      ? [
          {
            key: "language",
            header: tCommon("labels.language"),
            width: "7rem",
            cell: (row: GeoScanPendingAnswer) => (
              <span className="text-muted-foreground">{row.language}</span>
            ),
          },
        ]
      : []),
    {
      key: "status",
      header: tCommon("labels.status"),
      width: "12rem",
      cell: (row) => (
        <span className="text-muted-foreground inline-flex items-center gap-2">
          <HugeiconsIcon
            aria-hidden="true"
            className={
              row.status === "running"
                ? "text-primary shrink-0 motion-safe:animate-spin"
                : "shrink-0"
            }
            icon={
              (row.status === "running" && Loading03Icon) ||
              (row.status === "queued" && Clock01Icon) ||
              MinusSignIcon
            }
            size={14}
          />
          {pendingStatusLabel(row.status, t, tCommon)}
        </span>
      ),
    },
  ];
}

function scanPagination(
  offset: number,
  total: number,
  itemLabel: string,
  onOffsetChange: (offset: number) => void
): DataTablePagination {
  return {
    mode: "server",
    page: Math.floor(offset / GEO_SCAN_RESULTS_PAGE_SIZE) + 1,
    pageSize: GEO_SCAN_RESULTS_PAGE_SIZE,
    totalItems: total,
    itemLabel,
    onPageChange: (page) =>
      onOffsetChange((page - 1) * GEO_SCAN_RESULTS_PAGE_SIZE),
  };
}

function scanRunEmptyState(
  { isError, hasData, loading, onRetry }: GeoScanRunEmptyStateInput,
  t: ScanRunDetailTranslator,
  tCommon: CommonTranslator
): ReactNode {
  if (isError && !hasData) {
    return (
      <span className="text-muted-foreground flex flex-col items-center gap-2">
        {t("loadError")}
        <Button onClick={onRetry} size="sm" variant="outline">
          {tCommon("actions.tryAgain")}
        </Button>
      </span>
    );
  }
  if (!(loading || hasData)) {
    return t("unavailable");
  }
  return t("empty");
}

function ScanRunPendingTable({
  pending,
  showLanguage,
  emptyState,
  offset,
  onOffsetChange,
  total,
  height,
  loading,
}: GeoScanRunPendingTableProps) {
  const t = useTranslations("geo.scanRunDetail");
  const tShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  return (
    <DataTable
      columns={pendingColumns(showLanguage, t, tShared, tCommon)}
      data={pending}
      emptyState={emptyState}
      pagination={scanPagination(
        offset,
        total,
        t("itemMissing"),
        onOffsetChange
      )}
      getRowId={(row) => row.key}
      height={height}
      loading={loading}
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}

function ScanRunAnswersTable({
  results,
  showLanguage,
  emptyState,
  offset,
  onOffsetChange,
  total,
  height,
  loading,
  onRowClick,
}: GeoScanRunAnswersTableProps) {
  const t = useTranslations("geo.scanRunDetail");
  const tShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  return (
    <DataTable
      columns={answerColumns(showLanguage, t, tShared, tCommon, locale)}
      data={results.map((row, index) => ({
        ...row,
        repeated: results[index - 1]?.prompt === row.prompt,
      }))}
      emptyState={emptyState}
      pagination={scanPagination(
        offset,
        total,
        t("itemAnswers"),
        onOffsetChange
      )}
      getRowId={(row) => row.id}
      height={height}
      loading={loading}
      onRowClick={onRowClick}
      rowHeight={TABLE_ROW_HEIGHT}
      skeletonRows={GEO_SCAN_RESULTS_PAGE_SIZE / 2}
    />
  );
}

/**
 * A running scan: every planned answer is a row from the start, in plan
 * order, and fills in where it stands once its answer is saved.
 */
function ScanRunLiveTable({
  live,
  showLanguage,
  emptyState,
  onOffsetChange,
  height,
  loading,
  onRowClick,
}: GeoScanRunLiveTableProps) {
  const t = useTranslations("geo.scanRunDetail");
  const tShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  return (
    <DataTable
      columns={liveColumns(showLanguage, t, tShared, tCommon, locale)}
      data={live.rows.map((row, index) => ({
        ...row,
        repeated: live.rows[index - 1]?.promptId === row.promptId,
      }))}
      emptyState={emptyState}
      getRowClassName={(row) => (row.answer ? undefined : "cursor-default")}
      getRowId={(row) => row.key}
      height={height}
      loading={loading}
      onRowClick={(row) => {
        if (row.answer) {
          onRowClick(row.answer);
        }
      }}
      pagination={scanPagination(
        live.offset,
        live.total,
        t("itemAnswers"),
        onOffsetChange
      )}
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}

export function ScanRunFilters({
  view,
  onViewChange,
  answerCount,
  mentionedCount,
  pendingCount,
  running,
  engine,
  engines,
  onEngineChange,
}: GeoScanRunFiltersProps) {
  const t = useTranslations("geo.scanRunDetail");
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  const showViews = !running;
  const showEngines = engines.length > 1;
  if (!(showViews || showEngines)) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showViews ? (
        <Tabs
          onValueChange={(value) => {
            if (
              value === "answers" ||
              value === "mentioned" ||
              value === "pending"
            ) {
              onViewChange(value);
            }
          }}
          value={view}
        >
          <TabsList aria-label={t("viewLabel")}>
            <TabsTrigger value="answers">
              {tGeoShared("answers")}
              <ViewCount count={answerCount} locale={locale} />
            </TabsTrigger>
            <TabsTrigger value="mentioned">
              {tGeoShared("mentioned")}
              <ViewCount count={mentionedCount} locale={locale} />
            </TabsTrigger>
            {pendingCount > 0 ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <TabsTrigger value="pending">
                      {t("failed")}
                      <ViewCount count={pendingCount} locale={locale} />
                    </TabsTrigger>
                  }
                />
                <TooltipContent className="max-w-60">
                  {t("failedHint")}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </TabsList>
        </Tabs>
      ) : null}
      {showEngines ? (
        <Select
          onValueChange={(value) => onEngineChange(value ?? ALL_MODELS)}
          value={engine}
        >
          <SelectTrigger
            aria-label={t("filterByModel")}
            className="max-w-64 min-w-36"
          >
            <SelectValue>
              {engine === ALL_MODELS ? (
                tGeoShared("allModels")
              ) : (
                <>
                  <EngineIcon className="size-3.5" engine={engine} />
                  <span className="truncate">{formatEngineFamily(engine)}</span>
                </>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false}>
            <SelectItem value={ALL_MODELS}>
              {tGeoShared("allModels")}
            </SelectItem>
            {engines.map((item) => (
              <SelectItem key={item} value={item}>
                <span className="flex items-center gap-2">
                  <EngineIcon className="size-3.5" engine={item} />
                  {formatEngineFamily(item)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

function ViewCount({ count, locale }: GeoScanViewCountProps) {
  return (
    <span className="text-muted-foreground/70 text-xs font-normal tabular-nums">
      {count.toLocaleString(locale)}
    </span>
  );
}

function ScanRunEmpty({ isError, onRetry }: GeoScanRunEmptyProps) {
  const t = useTranslations("geo.scanRunDetail");
  const tEmpty = useTranslations("geo.scanActivityStatus.empty");
  const tCommon = useTranslations("common");
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={AiChat02Icon} />
        </EmptyMedia>
        <EmptyTitle>{isError ? t("loadError") : tEmpty("title")}</EmptyTitle>
        {isError ? null : (
          <EmptyDescription>{tEmpty("description")}</EmptyDescription>
        )}
      </EmptyHeader>
      {isError ? (
        <EmptyContent>
          <Button onClick={onRetry} size="sm" variant="outline">
            {tCommon("actions.tryAgain")}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function ScanRunDetail({ organizationId }: GeoScanRunDetailProps) {
  const tGeoShared = useTranslations("geo.shared");
  const isScanning = useIsGeoScanning(organizationId);
  const [state, setState] = useState(INITIAL_SCAN_RUN_STATE);
  const query = useGeoScanRun(
    organizationId,
    undefined,
    state.offset,
    state.engine || undefined,
    state.pendingOffset,
    state.view === "mentioned"
  );
  const run = query.data?.run;
  if (run && run.id !== state.runId) {
    setState({ ...INITIAL_SCAN_RUN_STATE, runId: run.id });
  }

  if (query.isPending) {
    return (
      <section aria-hidden="true" className="space-y-3">
        <Skeleton className="h-5 w-64 max-w-full" />
        <DataTableSkeleton rows={SCAN_SKELETON_ROWS} />
      </section>
    );
  }
  if (run) {
    return (
      <ScanRunLoaded
        onStateChange={setState}
        starting={isScanning}
        organizationId={organizationId}
        query={query}
        run={run}
        state={state}
      />
    );
  }
  if (isScanning && !query.isError) {
    return (
      <section aria-label={tGeoShared("scans")}>
        <DataTableSkeleton rows={SCAN_SKELETON_ROWS} />
      </section>
    );
  }
  return (
    <ScanRunEmpty
      isError={query.isError}
      onRetry={() => {
        void query.refetch();
      }}
    />
  );
}

function ScanRunLoaded({
  organizationId,
  run,
  query,
  state,
  starting,
  onStateChange: setState,
}: GeoScanRunLoadedProps) {
  const t = useTranslations("geo.scanRunDetail");
  const tCommon = useTranslations("common");
  const [openAnswer, setOpenAnswer] = useState<GeoScanOpenAnswer | null>(null);
  const checkId = openAnswer?.checkId ?? null;
  const model = scanRunDetailView({
    run,
    view: state.view,
    data: query.data ?? undefined,
    isPending: query.isPending,
    isPlaceholderData: query.isPlaceholderData,
    pendingOffset: state.pendingOffset,
  });
  const emptyState = scanRunEmptyState(
    {
      isError: query.isError,
      hasData: Boolean(query.data),
      loading: model.loading,
      onRetry: () => {
        void query.refetch();
      },
    },
    t,
    tCommon
  );
  const openRow = (row: GeoScanResultSummary) =>
    setOpenAnswer({ checkId: row.id, scanId: run.id, language: row.language });
  let table: ReactNode;
  if (model.live) {
    table = (
      <ScanRunLiveTable
        emptyState={emptyState}
        height={model.height}
        live={model.live}
        loading={model.loading}
        onOffsetChange={(offset) => setState((prev) => ({ ...prev, offset }))}
        onRowClick={openRow}
        showLanguage={model.showLanguage}
      />
    );
  } else if (model.activeView === "pending") {
    table = (
      <ScanRunPendingTable
        emptyState={emptyState}
        height={model.height}
        loading={model.loading}
        offset={model.pendingOffset}
        onOffsetChange={(pendingOffset) =>
          setState((prev) => ({ ...prev, pendingOffset }))
        }
        pending={model.pending}
        showLanguage={model.showLanguage}
        total={model.pendingTotal}
      />
    );
  } else {
    table = (
      <ScanRunAnswersTable
        emptyState={emptyState}
        height={model.height}
        loading={model.loading}
        offset={state.offset}
        onOffsetChange={(offset) => setState((prev) => ({ ...prev, offset }))}
        onRowClick={openRow}
        results={model.results}
        showLanguage={model.showLanguage}
        total={model.total}
      />
    );
  }

  return (
    <InstrumentSection
      action={
        <>
          <ScanActivityStatus run={run} starting={starting} />
          {model.hasFilters ? (
            <ScanRunFilters
              answerCount={model.answerCount}
              engine={state.engine}
              mentionedCount={model.mentionedCount}
              engines={model.engines}
              onEngineChange={(engine) =>
                setState((prev) => ({
                  ...prev,
                  engine,
                  offset: 0,
                  pendingOffset: 0,
                }))
              }
              onViewChange={(view) =>
                setState((prev) => ({ ...prev, view, offset: 0 }))
              }
              pendingCount={model.pendingTotal}
              running={model.running}
              view={model.activeView}
            />
          ) : null}
        </>
      }
      className="min-w-0"
      eyebrow={t("title")}
    >
      <div aria-busy={model.loading}>{table}</div>
      <ScanAnswerSheet
        checkId={checkId}
        initialLanguage={openAnswer?.language}
        key={checkId}
        onClose={() => setOpenAnswer(null)}
        organizationId={organizationId}
        scanId={openAnswer?.scanId ?? run.id}
      />
    </InstrumentSection>
  );
}
