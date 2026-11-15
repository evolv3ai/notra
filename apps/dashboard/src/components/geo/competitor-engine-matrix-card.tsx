"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { type CSSProperties, type PointerEvent, useState } from "react";
import { InstrumentEmpty, InstrumentModule } from "ui/card";
import { useTranslations } from "use-intl";

import { CursorTooltip } from "@/components/analytics/cursor-tooltip";
import { Button } from "@/components/button";
import { CompetitorLogo } from "@/components/geo/competitor-logo";
import { EngineIcon } from "@/components/geo/engine-icon";
import { GEO_ENGINE_MATRIX_COLLAPSED_ROWS } from "@/constants/geo-competitors";
import {
  useGeoCompetitorEngineMatrix,
  useGeoCompetitorRowNavigation,
} from "@/lib/hooks/use-geo";
import { cn } from "@/lib/utils";
import type { CursorTipState } from "@/types/analytics";
import type { CompetitorEngineMatrixCardProps } from "@/types/geo";
import { cursorTipPosition } from "@/utils/analytics-charts";
import { formatUsageShare } from "@/utils/geo-charts";
import {
  buildEngineMatrix,
  engineMatrixTint,
  engineMatrixUsesLightText,
} from "@/utils/geo-engine-matrix";

const MATRIX_CELL_CLASS =
  "flex h-9 items-center justify-center rounded-md text-sm ring-inset transition-shadow hover:ring-1 hover:ring-foreground/20";

function MatrixCell({
  rate,
  minRate,
  maxRate,
  noChecksLabel,
  countLabel,
  onPointerMove,
}: {
  rate: number | null;
  minRate: number;
  maxRate: number;
  noChecksLabel: string;
  countLabel: string;
  onPointerMove: (event: PointerEvent<HTMLSpanElement>) => void;
}) {
  if (rate === null) {
    return (
      <span
        className={cn(MATRIX_CELL_CLASS, "bg-muted/40 text-muted-foreground")}
        onPointerMove={onPointerMove}
      >
        <span aria-hidden="true">–</span>
        <span className="sr-only">{noChecksLabel}</span>
      </span>
    );
  }
  const tint = engineMatrixTint(rate, minRate, maxRate);
  return (
    <span
      className={cn(
        MATRIX_CELL_CLASS,
        "bg-[color-mix(in_oklab,var(--primary)_var(--matrix-tint),var(--muted))] tabular-nums",
        engineMatrixUsesLightText(tint)
          ? "text-primary-foreground"
          : "text-foreground"
      )}
      onPointerMove={onPointerMove}
      style={{ "--matrix-tint": `${tint}%` } as CSSProperties}
    >
      {formatUsageShare(rate)}
      <span className="sr-only">, {countLabel}</span>
    </span>
  );
}

export function CompetitorEngineMatrixCard({
  organizationId,
  range,
  companyName,
  aliases,
  competitors,
  trackedEngines,
  isScanning = false,
  organizationSlug,
}: CompetitorEngineMatrixCardProps) {
  const t = useTranslations("geo.competitorEngineMatrix");
  const navigation = useGeoCompetitorRowNavigation(
    organizationSlug,
    organizationId
  );
  const [tip, setTip] = useState<CursorTipState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { data, isPending, isError } = useGeoCompetitorEngineMatrix(
    organizationId,
    range
  );

  if (isPending) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  const matrix = buildEngineMatrix(data, {
    companyName,
    aliases,
    competitors,
    trackedEngines,
  });
  const isEmpty =
    matrix.rows.length === 0 ||
    matrix.columns.every((column) => column.checks === 0);
  const collapsible = matrix.rows.length > GEO_ENGINE_MATRIX_COLLAPSED_ROWS;
  const visibleRows =
    collapsible && !expanded
      ? matrix.rows.slice(0, GEO_ENGINE_MATRIX_COLLAPSED_ROWS)
      : matrix.rows;
  let emptyMessage = t("empty");
  if (isError) {
    emptyMessage = t("loadFailed");
  } else if (isScanning) {
    emptyMessage = t("scanning");
  }

  return (
    <InstrumentModule
      bodyClassName="p-2"
      className={isEmpty ? "min-h-96" : undefined}
      eyebrow={t("title")}
      hint={t("hint")}
      readout={isError && !isEmpty ? t("refreshFailed") : undefined}
      variant="table"
    >
      {isEmpty ? (
        <InstrumentEmpty
          busy={isScanning && !isError}
          message={emptyMessage}
          seed="competitor-engine-matrix"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-[3px]">
            <caption className="sr-only">{t("tableLabel")}</caption>
            <thead>
              <tr>
                <th className="w-48 min-w-40" scope="col">
                  <span className="sr-only">{t("brandColumn")}</span>
                </th>
                {matrix.columns.map((column) => (
                  <th
                    className="min-w-20 px-1 pt-1 pb-1.5 text-xs font-medium"
                    key={column.family}
                    scope="col"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <EngineIcon
                        className="size-3.5 shrink-0"
                        engine={column.engine}
                      />
                      <span className="truncate">{column.label}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody onPointerLeave={() => setTip(null)}>
              {visibleRows.map((row) => {
                const openable = !row.own && Boolean(organizationSlug);
                const cellDetail = (index: number) => {
                  const checks = matrix.columns[index]?.checks ?? 0;
                  return checks === 0
                    ? t("noChecks")
                    : t("cellDetail", {
                        mentions: row.mentions[index] ?? 0,
                        checks,
                      });
                };
                return (
                  <tr
                    className={cn(
                      "group",
                      openable &&
                        "focus-visible:outline-ring cursor-pointer rounded-lg focus-visible:outline-2"
                    )}
                    key={row.own ? "own" : row.brand}
                    onClick={
                      openable ? () => navigation.openRow(row.brand) : undefined
                    }
                    onFocus={
                      openable
                        ? () => navigation.prefetchRow(row.brand)
                        : undefined
                    }
                    onKeyDown={
                      openable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              navigation.openRow(row.brand);
                            }
                          }
                        : undefined
                    }
                    onPointerEnter={
                      openable
                        ? () => navigation.prefetchRow(row.brand)
                        : undefined
                    }
                    tabIndex={openable ? 0 : undefined}
                  >
                    <th
                      className={cn(
                        "rounded-md px-2 text-left text-sm font-normal transition-colors",
                        row.own && "bg-primary/10 font-medium",
                        openable &&
                          "group-hover:bg-muted/60 group-focus-visible:bg-muted/60"
                      )}
                      scope="row"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <CompetitorLogo
                          competitors={competitors}
                          name={row.brand}
                        />
                        <span className="truncate">{row.brand}</span>
                        {row.own ? (
                          <span className="text-muted-foreground shrink-0 text-xs font-normal">
                            {t("you")}
                          </span>
                        ) : null}
                      </span>
                    </th>
                    {matrix.columns.map((column, index) => (
                      <td className="p-0" key={column.family}>
                        <MatrixCell
                          countLabel={cellDetail(index)}
                          maxRate={matrix.maxRate}
                          minRate={matrix.minRate}
                          noChecksLabel={t("noChecks")}
                          onPointerMove={(event) =>
                            setTip({
                              ...cursorTipPosition(event),
                              title: `${row.brand} · ${column.label}`,
                              detail: cellDetail(index),
                            })
                          }
                          rate={row.rates[index] ?? null}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {collapsible ? (
            <div className="flex justify-center pt-1">
              <Button
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
                size="xs"
                variant="ghost"
              >
                {expanded
                  ? t("showLess")
                  : t("showAll", { count: matrix.rows.length })}
                <HugeiconsIcon
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform",
                    expanded && "rotate-180"
                  )}
                  icon={ArrowDown01Icon}
                />
              </Button>
            </div>
          ) : null}
          <CursorTooltip tip={tip} />
        </div>
      )}
    </InstrumentModule>
  );
}
