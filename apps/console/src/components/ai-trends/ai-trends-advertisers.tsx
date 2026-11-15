"use client";

import {
  DataTable,
  type TableColumn,
} from "@notra/ui/components/ui/data-table";

import { BrandLogo } from "@/components/geo-reports/brand-logo";
import { AI_TRENDS_TABLE_ROW_HEIGHT } from "@/constants/ai-trends";
import type {
  AiTrendsAdvertiser,
  AiTrendsAdvertisersProps,
} from "@/types/ai-trends";
import { aiTrendsTableHeight, formatShare } from "@/utils/ai-trends";

const COLUMNS: TableColumn<AiTrendsAdvertiser>[] = [
  {
    key: "advertiser",
    header: "Advertiser",
    sortable: true,
    sortValue: (row) => row.brand ?? row.advertiser,
    cell: (row) => (
      <span className="flex min-w-0 items-center gap-2 truncate">
        <BrandLogo
          className="rounded"
          domain={row.advertiser}
          name={row.brand ?? row.advertiser}
          size={18}
        />
        <span className="font-medium">{row.brand ?? row.advertiser}</span>
        {row.brand ? (
          <span className="text-muted-foreground ml-2">{row.advertiser}</span>
        ) : null}
      </span>
    ),
  },
  {
    key: "answers",
    header: "Answers",
    hint: "Answers that showed at least one of their ads.",
    width: "8rem",
    align: "right",
    sortable: true,
    cell: (row) => (
      <span className="tabular-nums">{row.answers.toLocaleString("en")}</span>
    ),
  },
  {
    key: "share",
    header: "Share",
    hint: "Of the answers whose scraper reports ads at all.",
    width: "8rem",
    align: "right",
    sortable: true,
    cell: (row) => (
      <span className="text-muted-foreground tabular-nums">
        {formatShare(row.share)}
      </span>
    ),
  },
  {
    key: "engines",
    header: "Engines",
    collapsePriority: 1,
    sortValue: (row) => row.engines.length,
    cell: (row) => (
      <span className="text-muted-foreground truncate">
        {row.engines.join(", ")}
      </span>
    ),
  },
];

export function AiTrendsAdvertisers({ advertisers }: AiTrendsAdvertisersProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={advertisers}
      emptyState="No ads in this period. Ads only show up on commercial prompts."
      getRowId={(row) => row.advertiser}
      height={aiTrendsTableHeight(advertisers.length)}
      rowHeight={AI_TRENDS_TABLE_ROW_HEIGHT}
    />
  );
}
