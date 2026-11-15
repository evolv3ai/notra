"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CompetitorLogo } from "@notra/ui/components/geo/competitor-logo";
import { GeoBar } from "@notra/ui/components/geo/geo-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { cn } from "@notra/ui/lib/utils";
import type { KeyboardEvent, ReactNode } from "react";

import { ReportPanel } from "@/components/state-of-ai-search/report-section";
import type { StateOfAiSearchRankingRow } from "@/types/state-of-ai-search";
import { brandColor, formatPercent } from "@/utils/state-of-ai-search";

const PERCENT_MAX = 100;
export const LOGO_OUTLINE =
  "outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

export function Brand({
  name,
  domain,
  className,
}: {
  name: string;
  domain: string;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <CompetitorLogo className={LOGO_OUTLINE} domain={domain} name={name} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function PercentBar({
  value,
  max = PERCENT_MAX,
  color,
}: {
  value: number | null;
  max?: number;
  color?: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <GeoBar className="w-16" fillColor={color} max={max} value={value ?? 0} />
      <span className="w-10 text-right font-medium tabular-nums">
        {formatPercent(value)}
      </span>
    </span>
  );
}

export function MutedText({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground tabular-nums">{children}</span>;
}

export function StatStrip({
  stats,
}: {
  stats: { label: string; value: ReactNode }[];
}) {
  return (
    <ReportPanel bodyClassName="divide-border/60 grid grid-cols-3 divide-x">
      {stats.map((stat) => (
        <div className="flex min-w-0 flex-col gap-1 px-4 py-3" key={stat.label}>
          <span className="text-muted-foreground text-xs">{stat.label}</span>
          <span className="truncate text-xl font-semibold tracking-tight tabular-nums">
            {stat.value}
          </span>
        </div>
      ))}
    </ReportPanel>
  );
}

export interface ReportListColumn<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  grow?: boolean;
  cell: (row: T) => ReactNode;
}

export function ReportList<T>({
  rows,
  columns,
  getKey,
  onSelect,
  getHref,
}: {
  rows: readonly T[];
  columns: ReportListColumn<T>[];
  getKey: (row: T) => string;
  onSelect?: (row: T) => void;
  getHref?: (row: T) => string;
}) {
  const activate = (row: T) => {
    if (getHref) {
      window.open(getHref(row), "_blank", "noopener,noreferrer");
      return;
    }
    onSelect?.(row);
  };
  const interactive = Boolean(onSelect ?? getHref);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              className={cn(column.align === "right" && "text-right")}
              key={column.key}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            className={cn(
              interactive &&
                "focus-visible:outline-ring cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2"
            )}
            key={getKey(row)}
            onClick={interactive ? () => activate(row) : undefined}
            onKeyDown={
              interactive
                ? (event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activate(row);
                    }
                  }
                : undefined
            }
            tabIndex={interactive ? 0 : undefined}
          >
            {columns.map((column) => (
              <TableCell
                className={cn(
                  column.align === "right" && "text-right",
                  column.grow
                    ? "w-full py-3 text-pretty whitespace-normal"
                    : "whitespace-nowrap"
                )}
                key={column.key}
              >
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LeaderList({
  leaders,
}: {
  leaders: StateOfAiSearchRankingRow[];
}) {
  return (
    <ol className="divide-border/60 divide-y">
      {leaders.map((row) => (
        <li
          className="flex h-12 items-center gap-3 px-4 text-sm"
          key={row.name}
        >
          <span className="w-4">
            <MutedText>{row.rank}</MutedText>
          </span>
          <span className="min-w-0 flex-1">
            <Brand domain={row.domain} name={row.name} />
          </span>
          <PercentBar color={brandColor(row.rank)} value={row.visibility} />
        </li>
      ))}
    </ol>
  );
}

export function ReadReportRow({ subject }: { subject: string }) {
  return (
    <span className="text-muted-foreground group-hover:text-foreground border-border/60 flex h-11 items-center justify-between border-t px-4 text-sm font-medium transition-colors">
      Read the {subject} report
      <HugeiconsIcon
        className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        icon={ArrowRight01Icon}
      />
    </span>
  );
}
