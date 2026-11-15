"use client";

import { useFlag } from "@databuddy/sdk/react";
import { isDemoModeClient } from "@notra/utils/demo-mode";
import { useState } from "react";

import { SITE_BULK_IMPORT_MIN_DIRECTORIES } from "@/constants/site-create";
import { SITES_BULK_IMPORT_FLAG_KEY } from "@/constants/sites";
import type {
  SiteBulkImportScope,
  SiteBulkResult,
  SiteBulkRow,
  SiteBulkRowEdit,
  SiteBulkScan,
} from "@/types/sites";
import {
  isSiteBulkReady,
  isSiteBulkRowCreated,
  siteBulkResultsByDirectory,
  siteBulkRows,
  siteBulkSlugIssues,
} from "@/utils/site-create-bulk";

/** Rows, selection and outcomes of importing every site of a repository at once. */
export function useSiteBulkImport({
  repository,
  branch,
  suggestions,
}: SiteBulkImportScope) {
  const flag = useFlag(SITES_BULK_IMPORT_FLAG_KEY);
  const [enabled, setEnabled] = useState(false);
  const [edits, setEdits] = useState<Record<string, SiteBulkRowEdit>>({});
  const [results, setResults] = useState<Record<string, SiteBulkResult>>({});
  const [previewsEnabled, setPreviewsEnabled] = useState(false);
  const repositoryId = repository?.id ?? null;
  const [scopeId, setScopeId] = useState(repositoryId);
  if (scopeId !== repositoryId) {
    setScopeId(repositoryId);
    setEnabled(false);
    setEdits({});
    setResults({});
    setPreviewsEnabled(false);
  }
  const scope = `${repositoryId ?? ""}:${branch}`;
  const [scan, setScan] = useState<SiteBulkScan | null>(null);
  if (
    suggestions.isReady &&
    (scan?.scope !== scope ||
      scan.directories !== suggestions.configDirectories)
  ) {
    setScan({
      scope,
      directories: suggestions.configDirectories,
      contentCounts: suggestions.contentCounts,
    });
  }
  const current = scan?.scope === scope ? scan : null;
  const directories = [
    ...new Set([...(current?.directories ?? []), ...Object.keys(results)]),
  ];

  const rows = siteBulkRows({
    directories,
    contentCounts: current?.contentCounts,
    repositoryName: repository?.repo ?? "",
    edits,
    results,
  });
  const createdCount = rows.filter(isSiteBulkRowCreated).length;
  const flagOn = !isDemoModeClient() && flag.status === "ready" && flag.on;
  const available =
    flagOn &&
    repository !== null &&
    (createdCount > 0 || rows.length >= SITE_BULK_IMPORT_MIN_DIRECTORIES);
  const pendingRows = rows.filter((row) => !isSiteBulkRowCreated(row));
  const selectedRows = pendingRows.filter((row) => row.selected);
  const issues = siteBulkSlugIssues(selectedRows);

  const updateRow = (rootDirectory: string, edit: SiteBulkRowEdit) => {
    setEdits((current) => ({
      ...current,
      [rootDirectory]: { ...current[rootDirectory], ...edit },
    }));
    setResults((current) => {
      if (!current[rootDirectory]) {
        return current;
      }
      return Object.fromEntries(
        Object.entries(current).filter(
          ([directory]) => directory !== rootDirectory
        )
      );
    });
  };

  const selectAll = (selected: boolean) =>
    setEdits((current) => {
      const next = { ...current };
      for (const row of pendingRows) {
        next[row.rootDirectory] = { ...next[row.rootDirectory], selected };
      }
      return next;
    });

  const recordResults = (submitted: SiteBulkRow[], outcome: SiteBulkResult[]) =>
    setResults((current) => ({
      ...current,
      ...siteBulkResultsByDirectory(submitted, outcome),
    }));

  return {
    available,
    active: available && enabled,
    setEnabled,
    rows,
    pendingRows,
    selectedRows,
    submittedRows: rows.filter((row) => row.result !== null),
    createdCount,
    issues,
    isReady: isSiteBulkReady(selectedRows, issues),
    previewsEnabled,
    setPreviewsEnabled,
    updateRow,
    selectAll,
    recordResults,
  };
}
