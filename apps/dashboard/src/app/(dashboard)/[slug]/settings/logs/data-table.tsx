"use client";

import { DataTable } from "ui/table";
import { useTranslations } from "use-intl";

import { SETTINGS_TABLE_EMPTY_HEIGHT } from "@/constants/settings";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import type { DataTableProps as LogsDataTableProps } from "@/types/logs/data-table";
import { paginatedTableHeightFor } from "@/utils/table";

const LOGS_SKELETON_ROW_COUNT = 10;

export function LogsDataTable<TData>({
  columns,
  data,
  getRowId,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading,
  emptyState,
  onRowClick,
  sort,
  onSortChange,
  totalCount,
}: LogsDataTableProps<TData>) {
  const t = useTranslations("settings.logs");
  let height: number | undefined;
  if (data.length === 0) {
    height = isLoading
      ? paginatedTableHeightFor(LOGS_SKELETON_ROW_COUNT, TABLE_ROW_HEIGHT)
      : SETTINGS_TABLE_EMPTY_HEIGHT;
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      defaultSort={{ key: "createdAt", direction: "desc" }}
      emptyState={emptyState}
      pagination={{
        mode: "server",
        page,
        pageSize,
        totalItems: totalCount,
        onPageChange,
        onPageSizeChange,
        itemLabel: t("itemLabel"),
      }}
      getRowId={getRowId}
      height={height}
      loading={isLoading}
      onRowClick={onRowClick}
      onSortChange={onSortChange}
      rowHeight={TABLE_ROW_HEIGHT}
      sort={sort}
    />
  );
}
