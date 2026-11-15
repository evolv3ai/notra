"use client";

import type { GeoJourneySourceStats } from "@notra/geo-core/types/geo";
import { formatGeoSource } from "@notra/geo-core/utils/ai-traffic";
import { InstrumentSection } from "ui/card";
import { DataTable, type TableColumn } from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import { EngineIcon } from "@/components/geo/engine-icon";
import { GeoCountCell } from "@/components/geo/geo-count-cell";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import type { JourneyOverviewCardProps } from "@/types/geo";
import { geoCountColumnWidth } from "@/utils/geo-count-column-width";
import { tableHeightFor } from "@/utils/table";

const sourceRowId = (row: GeoJourneySourceStats) =>
  `${row.source}-${row.visitorType}`;

export function JourneyOverviewCard({
  sources,
  previewRows,
  onOpenSource,
  loading = false,
}: JourneyOverviewCardProps) {
  const t = useTranslations("geo.journeyOverviewCard");
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const rows = sources.filter((row) => row.journeys > 0);
  const columns: TableColumn<GeoJourneySourceStats>[] = [
    {
      key: "source",
      header: tCommon("labels.source"),
      width: "1fr",
      sortable: true,
      sortValue: (row) => formatGeoSource(row.source),
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <EngineIcon engine={row.source} />
          <span className="max-w-full shrink-0 truncate">
            {formatGeoSource(row.source)}
          </span>
          <span className="text-muted-foreground min-w-0 truncate text-xs">
            {row.visitorType === "crawler"
              ? tGeoShared("crawler")
              : tGeoShared("aiReferral")}
          </span>
        </span>
      ),
    },
    {
      key: "journeys",
      header: tCommon("labels.journeys"),
      width: geoCountColumnWidth(
        rows.map((row) => ({
          value: row.journeys,
          previousValue: row.previousJourneys,
        })),
        locale,
        tCommon("labels.new")
      ),
      align: "right",
      sortable: true,
      cell: (row) => (
        <GeoCountCell
          value={row.journeys}
          label={formatGeoSource(row.source)}
          previousValue={row.previousJourneys}
        />
      ),
    },
  ];

  return (
    <InstrumentSection
      className="h-full"
      eyebrow={tCommon("labels.sources")}
      readout={t("sourceCount", { count: rows.length })}
    >
      <DataTable
        columns={columns}
        data={rows}
        defaultSort={{ key: "journeys", direction: "desc" }}
        getRowId={sourceRowId}
        height={tableHeightFor(previewRows)}
        loading={loading}
        onRowClick={onOpenSource}
        rowHeight={TABLE_ROW_HEIGHT}
      />
    </InstrumentSection>
  );
}
