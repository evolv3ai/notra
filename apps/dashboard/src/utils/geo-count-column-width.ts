import { trafficVisitDelta } from "@notra/geo-core/utils/ai-traffic";

import { GEO_COUNT_COLUMN_WIDTH } from "@/constants/geo-table";
import type { GeoCountCellProps } from "@/types/geo";
import { formatGeoStatDelta } from "@/utils/geo-charts";

export function geoCountColumnWidth(
  cells: readonly Pick<GeoCountCellProps, "value" | "previousValue">[],
  locale: string,
  newLabel: string
): string {
  const formatter = new Intl.NumberFormat(locale);
  let characters = 0;
  for (const { value, previousValue } of cells) {
    const change =
      previousValue == null ? null : trafficVisitDelta(value, previousValue);
    const delta =
      change === null
        ? ""
        : formatGeoStatDelta(change, "mentions", locale, {
            new: newLabel,
            points: String,
          });
    characters = Math.max(
      characters,
      formatter.format(value).length + delta.length
    );
  }
  // Tabular digits use ch; the remaining space covers cell/badge padding,
  // the trend icon and the gap. Badge text is smaller than the table's digits.
  return `max(${GEO_COUNT_COLUMN_WIDTH}, calc(${characters}ch + 5rem))`;
}
