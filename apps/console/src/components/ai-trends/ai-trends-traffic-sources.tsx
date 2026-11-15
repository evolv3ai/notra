"use client";

import { EngineIcon } from "@notra/ui/components/geo/engine-icon";
import { PurposeBadge } from "@notra/ui/components/geo/purpose-badge";
import {
  DataTable,
  type TableColumn,
} from "@notra/ui/components/ui/data-table";

import { AiTrendsChange } from "@/components/ai-trends/ai-trends-change";
import { AI_TRENDS_TABLE_ROW_HEIGHT } from "@/constants/ai-trends";
import type {
  AiTrendsTrafficSource,
  AiTrendsTrafficSourcesProps,
} from "@/types/ai-trends";
import { aiTrendsTableHeight, formatShare } from "@/utils/ai-trends";

const COLUMNS: TableColumn<AiTrendsTrafficSource>[] = [
  {
    key: "label",
    header: "Source",
    sortable: true,
    cell: (row) => (
      <span className="flex min-w-0 items-center gap-2">
        <EngineIcon className="size-4" engine={row.source} />
        <span className="truncate font-medium">{row.label}</span>
      </span>
    ),
  },
  {
    key: "category",
    header: "Purpose",
    width: "11rem",
    sortable: true,
    collapsePriority: 2,
    cell: (row) => <PurposeBadge category={row.category} />,
  },
  {
    key: "visits",
    header: "Visits",
    hint: "Last 7 days, every site.",
    width: "7rem",
    align: "right",
    sortable: true,
    cell: (row) => (
      <span className="tabular-nums">{row.visits.toLocaleString("en")}</span>
    ),
  },
  {
    key: "sites",
    header: "Sites",
    hint: "Sites the source reached in the last 7 days.",
    width: "6rem",
    align: "right",
    sortable: true,
    collapsePriority: 3,
    cell: (row) => (
      <span className="text-muted-foreground tabular-nums">
        {row.sites.toLocaleString("en")}
      </span>
    ),
  },
  {
    key: "markdown",
    header: "Markdown",
    hint: "Share of visits that asked for Markdown instead of HTML.",
    width: "7rem",
    align: "right",
    sortable: true,
    collapsePriority: 1,
    sortValue: (row) => (row.visits > 0 ? row.markdownVisits / row.visits : 0),
    cell: (row) => (
      <span className="text-muted-foreground tabular-nums">
        {row.markdownVisits > 0
          ? formatShare(row.markdownVisits / row.visits)
          : "–"}
      </span>
    ),
  },
  {
    key: "change",
    header: "Change",
    hint: "The median site's visits, last 7 days against the 3 weeks before. One site's crawl sweep can't move it.",
    width: "7rem",
    align: "right",
    sortable: true,
    sortValue: (row) => row.change ?? Number.NEGATIVE_INFINITY,
    cell: (row) => <AiTrendsChange change={row.change} />,
  },
];

export function AiTrendsTrafficSources({
  sources,
}: AiTrendsTrafficSourcesProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={sources}
      getRowId={(row) => row.id}
      height={aiTrendsTableHeight(sources.length)}
      rowHeight={AI_TRENDS_TABLE_ROW_HEIGHT}
    />
  );
}
