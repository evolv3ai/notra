"use client";

import {
  DataTable,
  type TableColumn,
} from "@notra/ui/components/ui/data-table";

import { AiTrendsChange } from "@/components/ai-trends/ai-trends-change";
import { BrandLogo } from "@/components/geo-reports/brand-logo";
import { AI_TRENDS_TABLE_ROW_HEIGHT } from "@/constants/ai-trends";
import type {
  AiTrendsTopDomain,
  AiTrendsTopDomainsProps,
} from "@/types/ai-trends";
import {
  aiTrendsTableHeight,
  changeOrNull,
  formatShare,
} from "@/utils/ai-trends";

/** Smaller moves are noise at weekly volumes, so they stay uncolored. */
const CHANGE_TONE = 0.1;

const COLUMNS: TableColumn<AiTrendsTopDomain>[] = [
  {
    key: "domain",
    header: "Domain",
    sortable: true,
    cell: (row) => (
      <span className="flex min-w-0 items-center gap-2">
        <BrandLogo
          className="rounded"
          domain={row.domain}
          name={row.domain}
          size={18}
        />
        <span className="truncate font-medium">{row.domain}</span>
      </span>
    ),
  },
  {
    key: "share",
    header: "Share",
    hint: "Share of all citations in the last 7 days.",
    width: "8rem",
    align: "right",
    sortable: true,
    cell: (row) => (
      <span className="tabular-nums">{formatShare(row.share)}</span>
    ),
  },
  {
    key: "change",
    header: "Change",
    hint: "Share against the 3 weeks before, over prompts asked in both.",
    width: "8rem",
    align: "right",
    sortable: true,
    sortValue: (row) =>
      changeOrNull(row.matchedShare, row.baselineShare) ??
      Number.POSITIVE_INFINITY,
    cell: (row) => (
      <AiTrendsChange
        change={changeOrNull(row.matchedShare, row.baselineShare)}
        empty={row.matchedShare > 0 ? "New" : "–"}
        threshold={CHANGE_TONE}
      />
    ),
  },
  {
    key: "citations",
    header: "Citations",
    width: "8rem",
    align: "right",
    sortable: true,
    collapsePriority: 2,
    cell: (row) => (
      <span className="text-muted-foreground tabular-nums">
        {row.citations.toLocaleString("en")}
      </span>
    ),
  },
  {
    key: "engines",
    header: "Engines",
    width: "7rem",
    align: "right",
    sortable: true,
    collapsePriority: 1,
    cell: (row) => (
      <span className="text-muted-foreground tabular-nums">{row.engines}</span>
    ),
  },
];

export function AiTrendsTopDomains({
  domains,
  onSelect,
}: AiTrendsTopDomainsProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={domains}
      emptyState="No citations in the last 7 days."
      getRowId={(row) => row.domain}
      height={aiTrendsTableHeight(domains.length)}
      onRowClick={(row) => onSelect(row.domain)}
      rowHeight={AI_TRENDS_TABLE_ROW_HEIGHT}
    />
  );
}
