import type { DataTableSkeletonColumn } from "ui/table/types";

export const COLLECTIONS_PAGE_SIZE = 20;
export const COLLECTION_TABLE_ROW_HEIGHT = 56;
export const COLLECTION_TABLE_SKELETON_ROWS = 6;
/** Name, format, status, created, actions: mirrors the loaded table. */
export const COLLECTION_TABLE_SKELETON_COLUMNS: readonly DataTableSkeletonColumn[] =
  [
    { width: "1fr", minWidth: "14rem" },
    { width: "10rem", collapsePriority: 2 },
    { width: "8rem", collapsePriority: 1 },
    { width: "8.5rem", collapsePriority: 3 },
    { width: "4rem", minWidth: "4rem", align: "right" },
  ];
export const COLLECTION_TABLE_TOOLTIP_DELAY_MS = 300;
export const COLLECTION_TYPE_STACK_LIMIT = 4;
export const CONTENT_LIST_VIEWS = ["list", "calendar"] as const;
export const COLLECTION_JUST_NOW_MS = 60_000;
