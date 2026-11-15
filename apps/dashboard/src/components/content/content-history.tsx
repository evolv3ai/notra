"use client";

import {
  Alert02Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@notra/ui/components/ui/alert-dialog";
import { Badge } from "@notra/ui/components/ui/badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  CONTENT_HISTORY_PANEL_CLASSNAME as PANEL_CLASSNAME,
  CONTENT_HISTORY_SKELETON_ROWS as SKELETON_ROWS,
} from "@/constants/content-history";
import { useContentHistory } from "@/lib/hooks/use-content-history";
import { useSiteCodeHighlighter } from "@/lib/hooks/use-site-code-highlighter";
import type {
  ContentHistoryComparisonProps,
  ContentHistoryDay,
  ContentHistoryListProps,
  ContentHistoryProps,
} from "@/types/content/history";
import {
  groupContentHistoryByDay,
  LOCAL_TIME_ZONE,
} from "@/utils/content-history-days";
import lazyComponent from "@/utils/lazy-component";

function VersionLoading() {
  const t = useTranslations("content.history");
  return (
    <p className="text-muted-foreground px-3 py-2.5 text-xs" role="status">
      {t("loadingVersion")}
    </p>
  );
}

const SiteFileDiff = lazyComponent(
  () =>
    import("@/components/sites/site-file-diff").then((module) => ({
      default: module.SiteFileDiff,
    })),
  { loading: VersionLoading }
);

function ContentHistoryList({
  history,
  versionId,
  setVersionId,
  restore,
  needsRefresh,
  currentRevision,
  currentTitle,
}: ContentHistoryListProps) {
  const t = useTranslations("content.history");
  const format = useFormatter();
  const headingId = useId();
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const days = groupContentHistoryByDay(items);
  const dayLabel = (day: ContentHistoryDay) => {
    if (day.daysAgo === 0) {
      return t("today");
    }
    if (day.daysAgo === 1) {
      return t("yesterday");
    }
    return format.dateTime(day.date, {
      timeZone: LOCAL_TIME_ZONE,
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <section aria-labelledby={headingId}>
      <h3 className="sr-only" id={headingId}>
        {t("versions")}
      </h3>
      {history.isPending ? (
        <div className="space-y-1" role="status">
          <span className="sr-only">{t("loading")}</span>
          {SKELETON_ROWS.map((row) => (
            <div className="flex items-center gap-3 px-2.5 py-2" key={row}>
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {history.isError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2"
          role="alert"
        >
          <p className="text-muted-foreground min-w-0 flex-1 text-sm">
            {t("loadFailed")}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void history.refetch();
            }}
          >
            {t("retry")}
          </Button>
        </div>
      ) : null}
      {history.data?.pages[0]?.items.length === 0 ? (
        <p className="text-muted-foreground px-2.5 py-2 text-sm">
          {t("empty")}
        </p>
      ) : null}
      {days.map((day) => (
        <div key={day.key}>
          <h4 className="text-muted-foreground px-2.5 pt-3 pb-1 text-xs font-medium">
            {dayLabel(day)}
          </h4>
          <ol className="space-y-0.5">
            {day.items.map((item) => {
              const isCurrent = item.revision === currentRevision;
              const showTitle = item.title !== currentTitle;
              const actor = item.actor?.name ?? t("unknownActor");
              return (
                <li key={item.id}>
                  <button
                    className="hover:bg-muted/60 focus-visible:ring-ring/50 aria-pressed:bg-muted flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                    type="button"
                    aria-pressed={versionId === item.id}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => {
                      setVersionId(item.id);
                      restore.reset();
                    }}
                    disabled={restore.isPending || needsRefresh}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums">
                          {item.number
                            ? t("revision", { revision: item.number })
                            : t(`sources.${item.source}`)}
                        </span>
                        {isCurrent ? (
                          <Badge shape="rounded" size="sm" variant="secondary">
                            {t("current")}
                          </Badge>
                        ) : null}
                        {item.retained && !isCurrent ? (
                          <Badge shape="rounded" size="sm" variant="outline">
                            {t("retained")}
                          </Badge>
                        ) : null}
                        <time
                          className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums"
                          dateTime={item.createdAt}
                        >
                          {format.dateTime(new Date(item.createdAt), {
                            timeZone: LOCAL_TIME_ZONE,
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {item.changes?.length
                          ? item.changes
                              .map((change) => t(`changes.${change}`))
                              .join(", ")
                          : t(`sources.${item.source}`)}
                        {" · "}
                        {actor}
                        {showTitle ? ` · ${item.title}` : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {history.hasNextPage ? (
        <Button
          className="mt-1 w-full"
          size="sm"
          variant="ghost"
          loading={history.isFetchingNextPage}
          disabled={history.isFetchingNextPage}
          onClick={() => {
            void history.fetchNextPage();
          }}
        >
          {t("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}

export function ContentHistory(props: ContentHistoryProps) {
  const t = useTranslations("content.history");
  const highlighterReady = useSiteCodeHighlighter();
  const {
    history,
    selected,
    versionId,
    setVersionId,
    restore,
    canRestore,
    canRefresh,
    needsRefresh,
  } = useContentHistory(props);
  const [confirm, setConfirm] = useState(false);
  const firstPage = history.data?.pages[0]?.items;
  const version = selected.data?.version;
  const currentRevision = props.content.revision;
  const hasUnsavedWork = props.document.hasChanges || props.document.isSaving;
  const previous = firstPage?.find((item) => item.revision !== currentRevision);

  useEffect(() => {
    if (versionId === null && previous) {
      setVersionId(previous.id);
    }
  }, [versionId, previous, setVersionId]);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1">
      <aside className="min-h-0 overflow-y-auto overscroll-contain border-b p-2 max-md:max-h-56 md:border-r md:border-b-0">
        <ContentHistoryList
          history={history}
          versionId={versionId}
          setVersionId={setVersionId}
          restore={restore}
          needsRefresh={needsRefresh}
          currentRevision={currentRevision}
          currentTitle={props.document.title}
        />
      </aside>
      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-5">
        {hasUnsavedWork ? (
          <Alert role="status">
            <HugeiconsIcon
              aria-hidden="true"
              icon={InformationCircleIcon}
              strokeWidth={1.75}
            />
            <AlertDescription>{t("saveFirst")}</AlertDescription>
          </Alert>
        ) : null}
        {selected.isFetching && versionId && !version ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : null}
        {selected.isError ? (
          <Alert variant="destructive">
            <HugeiconsIcon
              aria-hidden="true"
              icon={Alert02Icon}
              strokeWidth={1.5}
            />
            <AlertTitle>{t("versionFailed")}</AlertTitle>
            <div className="text-foreground col-start-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void selected.refetch();
                }}
              >
                {t("retry")}
              </Button>
            </div>
          </Alert>
        ) : null}
        {version ? (
          <ContentHistoryComparison
            version={version}
            versionNumber={
              history.data?.pages
                .flatMap((page) => page.items)
                .find((item) => item.id === version.id)?.number
            }
            fetching={selected.isFetching}
            highlighterReady={highlighterReady}
            currentRevision={currentRevision}
            currentMarkdown={props.document.currentMarkdown}
            hasUnsavedWork={hasUnsavedWork}
            restore={restore}
            canRestore={canRestore}
            onConfirmRestore={() => setConfirm(true)}
          />
        ) : null}
        {restore.isError ? (
          <Alert variant="destructive">
            <HugeiconsIcon
              aria-hidden="true"
              icon={Alert02Icon}
              strokeWidth={1.5}
            />
            <AlertTitle>{t("restoreFailed")}</AlertTitle>
            <AlertDescription className="wrap-anywhere">
              {restore.error.message}
            </AlertDescription>
            {needsRefresh ? (
              <div className="text-foreground col-start-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canRefresh}
                  onClick={() => restore.mutate()}
                >
                  {t("loadRestored")}
                </Button>
              </div>
            ) : null}
          </Alert>
        ) : null}
        {restore.isSuccess ? (
          <Alert role="status" variant="success">
            <HugeiconsIcon
              aria-hidden="true"
              icon={CheckmarkCircle02Icon}
              strokeWidth={1.75}
            />
            <AlertDescription>{t("restored")}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button
              disabled={!canRestore}
              onClick={() => {
                setConfirm(false);
                restore.mutate();
              }}
            >
              {t("restore")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ContentHistoryComparison({
  version,
  versionNumber,
  fetching,
  highlighterReady,
  currentRevision,
  currentMarkdown,
  hasUnsavedWork,
  restore,
  canRestore,
  onConfirmRestore,
}: ContentHistoryComparisonProps) {
  const t = useTranslations("content.history");
  const format = useFormatter();
  const compareHeadingId = useId();
  let status = t("restoreHint");
  if (restore.isPending) {
    status = t("restoring");
  } else if (fetching) {
    status = t("loadingVersion");
  } else if (version.revision === currentRevision) {
    status = t("currentSelected");
  } else if (hasUnsavedWork) {
    status = t("compareDescription");
  }
  return (
    <section aria-labelledby={compareHeadingId} className="space-y-3">
      <header className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium" id={compareHeadingId}>
            {t("compareWith", {
              version: versionNumber
                ? t("revision", { revision: versionNumber })
                : format.dateTime(new Date(version.createdAt), {
                    timeZone: LOCAL_TIME_ZONE,
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }),
            })}
          </h3>
          <p
            className="text-muted-foreground text-xs text-pretty"
            role={restore.isPending || fetching ? "status" : undefined}
          >
            {status}
          </p>
        </div>
        <Button
          size="sm"
          disabled={!canRestore}
          loading={restore.isPending}
          onClick={onConfirmRestore}
        >
          <HugeiconsIcon
            data-icon="inline-start"
            icon={Undo02Icon}
            strokeWidth={2}
          />
          {t("restore")}
        </Button>
      </header>
      {(version.markdown ?? "") === currentMarkdown ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
          {t("noChanges")}
        </p>
      ) : (
        <div className={PANEL_CLASSNAME}>
          {highlighterReady ? (
            <SiteFileDiff
              path="document.md"
              before={version.markdown ?? ""}
              after={currentMarkdown}
            />
          ) : (
            <VersionLoading />
          )}
        </div>
      )}
      <details className="group/metadata">
        <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg py-1 text-xs font-medium outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5 transition-transform duration-200 group-open/metadata:rotate-90 motion-reduce:transition-none"
            icon={ArrowRight01Icon}
            strokeWidth={2}
          />
          {t("metadata")}
        </summary>
        <div className={PANEL_CLASSNAME}>
          <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-4 gap-y-1.5 px-3 py-2.5 text-xs">
            <dt className="text-muted-foreground">{t("title")}</dt>
            <dd className="font-medium wrap-anywhere">{version.title}</dd>
            <dt className="text-muted-foreground">{t("slug")}</dt>
            <dd className="font-mono wrap-anywhere">{version.slug ?? "—"}</dd>
          </dl>
          <pre className="bg-muted/40 max-h-64 overflow-auto overscroll-contain border-t px-3 py-2.5 font-mono text-xs">
            {JSON.stringify(version.metadata, null, 2)}
          </pre>
        </div>
      </details>
    </section>
  );
}
