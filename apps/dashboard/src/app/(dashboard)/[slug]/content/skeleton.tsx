"use client";

import { DataTableSkeleton } from "ui/table";

import {
  COLLECTION_TABLE_ROW_HEIGHT,
  COLLECTION_TABLE_SKELETON_COLUMNS,
  COLLECTION_TABLE_SKELETON_ROWS,
} from "@/constants/content-collections";

export function CollectionsPageSkeleton() {
  return (
    <DataTableSkeleton
      columnWidths={COLLECTION_TABLE_SKELETON_COLUMNS}
      rowHeight={COLLECTION_TABLE_ROW_HEIGHT}
      rows={COLLECTION_TABLE_SKELETON_ROWS}
    />
  );
}
