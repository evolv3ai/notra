"use client";

import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GSC_SYNC_LOOKBACK_DAYS } from "@notra/geo-core/constants/google-search-console";
import { isQuestionQuery } from "@notra/geo-core/utils/gsc-question";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetScrollArea,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { useRetainedValue } from "@notra/ui/hooks/use-retained-value";
import { useMemo } from "react";
import { InstrumentModule } from "ui/card";
import { DataTable } from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import type {
  PromptSuggestionSheetProps,
  SuggestionQueryTableProps,
} from "@/types/components/geo";
import { formatCount, formatOneDecimal, formatPercent } from "@/utils/format";
import { suggestionKeywordTotals } from "@/utils/geo-prompt-suggestions";
import { tableHeightFor } from "@/utils/table";

function SuggestionQueryTable({ queries }: SuggestionQueryTableProps) {
  const t = useTranslations("geo.promptSuggestionSheet");
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  return (
    <section className="min-w-0 space-y-2">
      <h3 className="text-sm font-medium">{tGeoShared("searchQueries")}</h3>
      <DataTable
        autoHeight
        columns={[
          {
            key: "query",
            header: tCommon("labels.query"),
            width: "1fr",
            minWidth: "10rem",
            cell: (query) => (
              <span className="flex min-w-0 items-start gap-1.5 leading-snug">
                {isQuestionQuery(query.query) ? (
                  <HugeiconsIcon
                    aria-label={t("question")}
                    className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                    icon={HelpCircleIcon}
                    role="img"
                    strokeWidth={2}
                  />
                ) : null}
                <span className="min-w-0 wrap-anywhere">{query.query}</span>
              </span>
            ),
          },
          {
            key: "impressions",
            header: tCommon("labels.impressions"),
            width: "6.5rem",
            align: "right",
            cell: (query) => (
              <span className="tabular-nums">
                {formatCount(query.impressions, locale)}
              </span>
            ),
          },
          {
            key: "clicks",
            header: tCommon("labels.clicks"),
            width: "4.5rem",
            align: "right",
            cell: (query) => (
              <span className="tabular-nums">
                {formatCount(query.clicks, locale)}
              </span>
            ),
          },
          {
            key: "position",
            header: tCommon("labels.position"),
            width: "5.5rem",
            align: "right",
            cell: (query) => (
              <span className="tabular-nums">
                #{formatOneDecimal(query.position, locale)}
              </span>
            ),
          },
        ]}
        // Two to eight rows: a fixed order beats sort controls.
        data={[...queries].sort(
          (left, right) => right.impressions - left.impressions
        )}
        emptyState={t("noQueryData")}
        getRowId={(query) => query.query}
        height={tableHeightFor(0)}
        rowSizing="content"
      />
    </section>
  );
}

export function PromptSuggestionSheet({
  suggestion,
  actions,
  onOpenChange,
}: PromptSuggestionSheetProps) {
  const t = useTranslations("geo.promptSuggestionSheet");
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const payload = useMemo(
    () => (suggestion ? { suggestion, actions } : null),
    [suggestion, actions]
  );
  const [retained, releasePayload] = useRetainedValue(payload);
  const detail = retained?.suggestion;
  const totals = detail ? suggestionKeywordTotals(detail.keywords) : null;
  const title =
    detail?.title && detail.title !== detail.prompt ? detail.title : null;

  return (
    <Sheet
      onOpenChange={onOpenChange}
      onOpenChangeComplete={releasePayload}
      open={suggestion !== null}
    >
      <SheetContent
        className="data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:sm:max-w-3xl"
        side="right"
        variant="inset"
      >
        <SheetHeader className="bg-muted/50 shrink-0 gap-1.5 border-b pr-14">
          <SheetDescription>{t("suggestedPrompt")}</SheetDescription>
          <SheetTitle className="leading-snug text-balance wrap-anywhere">
            {detail?.prompt ?? t("suggestedPrompt")}
          </SheetTitle>
        </SheetHeader>

        {detail && totals ? (
          <SheetScrollArea
            className="bg-muted/20 min-h-full p-4 sm:px-4"
            key={detail.id}
          >
            <div className="space-y-4">
              <InstrumentModule
                eyebrow={tGeoShared("searchPerformance")}
                hint={t("lookback", { days: GSC_SYNC_LOOKBACK_DAYS })}
                variant="table-compact"
              >
                <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground text-xs">
                      {tCommon("labels.impressions")}
                    </dt>
                    <dd className="text-xl font-medium tabular-nums">
                      {formatCount(totals.impressions, locale)}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground text-xs">
                      {tCommon("labels.clicks")}
                    </dt>
                    <dd className="text-xl font-medium tabular-nums">
                      {formatCount(totals.clicks, locale)}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground text-xs">
                      {tGeoShared("clickThroughRate")}
                    </dt>
                    <dd className="text-xl font-medium tabular-nums">
                      {totals.ctr === null
                        ? "—"
                        : `${formatPercent(totals.ctr, locale)}%`}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground text-xs">
                      {tGeoShared("bestPosition")}
                    </dt>
                    <dd className="text-xl font-medium tabular-nums">
                      {totals.position === null
                        ? "—"
                        : `#${formatOneDecimal(totals.position, locale)}`}
                    </dd>
                  </div>
                </dl>
              </InstrumentModule>

              {title ? (
                <InstrumentModule
                  eyebrow={tGeoShared("suggestedTitle")}
                  variant="table-compact"
                >
                  <p className="text-sm leading-relaxed wrap-anywhere">
                    {title}
                  </p>
                </InstrumentModule>
              ) : null}

              <SuggestionQueryTable queries={detail.keywords} />
            </div>
          </SheetScrollArea>
        ) : null}

        {retained?.actions ? (
          <SheetFooter className="shrink-0 flex-row flex-wrap justify-end border-t">
            {retained.actions}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
