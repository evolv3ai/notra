"use client";

import type { GeoJourneyPageStats } from "@notra/geo-core/types/geo";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { InstrumentSection } from "ui/card";
import { DataTable, type TableColumn } from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import { GeoCountCell } from "@/components/geo/geo-count-cell";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import type { JourneyPathsCardProps } from "@/types/geo";
import { geoCountColumnWidth } from "@/utils/geo-count-column-width";
import { tableHeightFor } from "@/utils/table";

const pathRowId = (row: GeoJourneyPageStats) => row.path;

export function JourneyPathsCard({
  pages,
  totalPages,
  previewRows,
  onOpenPath,
  loading = false,
}: JourneyPathsCardProps) {
  const t = useTranslations("geo.journeyPathsCard");
  const locale = useLocale();
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const columns: TableColumn<GeoJourneyPageStats>[] = [
    {
      key: "path",
      header: tGeoShared("page"),
      width: "1fr",
      sortable: true,
      cell: (row) => (
        <TruncateWithTooltip className="font-mono text-sm">
          {row.path}
        </TruncateWithTooltip>
      ),
    },
    {
      key: "journeys",
      header: tCommon("labels.journeys"),
      width: geoCountColumnWidth(
        pages.map((row) => ({
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
          label={row.path}
          previousValue={row.previousJourneys}
        />
      ),
    },
  ];

  return (
    <InstrumentSection
      className="h-full"
      eyebrow={tGeoShared("fetchedPages")}
      readout={
        totalPages > pages.length
          ? t("topShown", { count: totalPages, shown: pages.length })
          : tGeoShared("countPluralOnePageOther", { count: totalPages })
      }
    >
      <DataTable
        columns={columns}
        data={pages}
        defaultSort={{ key: "journeys", direction: "desc" }}
        getRowId={pathRowId}
        height={tableHeightFor(previewRows)}
        loading={loading}
        onRowClick={onOpenPath}
        rowHeight={TABLE_ROW_HEIGHT}
      />
    </InstrumentSection>
  );
}
