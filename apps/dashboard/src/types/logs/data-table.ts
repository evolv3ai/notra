import type { ReactNode } from "react";
import type { TableColumn, SortState } from "ui/table";

import type {
  LogSourceFilter,
  LogStatusFilter,
} from "@/types/webhooks/webhooks";

export interface LogPageOptions {
  source: LogSourceFilter;
  status: LogStatusFilter;
  search: string;
  page: number;
  pageSize: number;
  sort: SortState | null;
}

export interface DataTableProps<TData> {
  columns: TableColumn<TData>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading?: boolean;
  emptyState: ReactNode;
  onRowClick?: (row: TData) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  totalCount: number;
}
