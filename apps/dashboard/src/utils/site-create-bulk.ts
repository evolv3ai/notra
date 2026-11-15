import { SITE_BULK_IMPORT_MAX_SITES } from "@notra/schemas/constants/dashboard/sites";
import {
  isReservedSiteSlug,
  slugifySiteName,
} from "@notra/sites-core/utils/hosts";

import {
  SITE_BULK_FOLDER_WORD_SEPARATOR,
  SITE_CREATE_FORM_DEFAULTS,
} from "@/constants/site-create";
import { SITE_NAME_MAX_LENGTH } from "@/constants/sites-form";
import type {
  SiteBulkResult,
  SiteBulkRow,
  SiteBulkRowsInput,
  SiteBulkSlugIssue,
  SiteBulkSubmitOptions,
  SiteCreateManyInput,
  SiteCreateTarget,
} from "@/types/sites";
import { isSiteSlugInvalid, siteCreateSectionPlan } from "@/utils/site-create";

/** `examples/sites/dark-launch` becomes "Dark launch"; the root keeps the repository name. */
export function siteBulkDefaultName(
  rootDirectory: string,
  repositoryName: string
): string {
  const segment = rootDirectory.split("/").findLast(Boolean);
  if (!segment) {
    return repositoryName.slice(0, SITE_NAME_MAX_LENGTH);
  }
  const words = segment
    .split(SITE_BULK_FOLDER_WORD_SEPARATOR)
    .filter(Boolean)
    .join(" ");
  const name = `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  return (name || segment).slice(0, SITE_NAME_MAX_LENGTH);
}

export function siteBulkRows({
  directories,
  contentCounts,
  repositoryName,
  edits,
  results,
}: SiteBulkRowsInput): SiteBulkRow[] {
  return directories.map((rootDirectory) => {
    const edit = edits[rootDirectory] ?? {};
    const name =
      edit.name ?? siteBulkDefaultName(rootDirectory, repositoryName);
    return {
      rootDirectory,
      name,
      slug: edit.slug ?? slugifySiteName(name),
      selected: edit.selected ?? true,
      sections: siteCreateSectionPlan(
        { ...SITE_CREATE_FORM_DEFAULTS, rootDirectory },
        contentCounts
      ),
      result: results[rootDirectory] ?? null,
    };
  });
}

export function isSiteBulkRowCreated(row: SiteBulkRow): boolean {
  return row.result !== null && "site" in row.result;
}

function siteBulkSlug(row: SiteBulkRow): string {
  return row.slug.trim().toLowerCase();
}

/** Address problems of the rows about to be submitted, keyed by folder. */
export function siteBulkSlugIssues(
  rows: SiteBulkRow[]
): Record<string, SiteBulkSlugIssue> {
  const issues: Record<string, SiteBulkSlugIssue> = {};
  const owners = new Map<string, string[]>();
  for (const row of rows) {
    const slug = siteBulkSlug(row);
    if (isSiteSlugInvalid(slug)) {
      issues[row.rootDirectory] = isReservedSiteSlug(slug)
        ? "reserved"
        : "invalid";
    } else if (slug) {
      owners.set(slug, [...(owners.get(slug) ?? []), row.rootDirectory]);
    }
  }
  for (const directories of owners.values()) {
    if (directories.length > 1) {
      for (const directory of directories) {
        issues[directory] = "duplicate";
      }
    }
  }
  return issues;
}

export function isSiteBulkReady(
  rows: SiteBulkRow[],
  issues: Record<string, SiteBulkSlugIssue>
): boolean {
  return (
    rows.length > 0 &&
    rows.length <= SITE_BULK_IMPORT_MAX_SITES &&
    Object.keys(issues).length === 0 &&
    rows.every((row) => row.name.trim().length > 0)
  );
}

export function siteBulkCreateInput(
  rows: SiteBulkRow[],
  { organizationId, repositoryId, projectId }: SiteCreateTarget,
  { branch, previewsEnabled }: SiteBulkSubmitOptions
): SiteCreateManyInput {
  return {
    organizationId,
    projectId,
    repositoryId,
    productionBranch: branch.trim() || undefined,
    previewsEnabled,
    sites: rows.map((row) => ({
      name: row.name.trim(),
      slug: siteBulkSlug(row) || undefined,
      rootDirectory: row.rootDirectory || undefined,
      mounts: {
        blog: row.sections.blogPath.trim() || undefined,
        changelog: row.sections.changelogPath.trim() || undefined,
      },
    })),
  };
}

/** Results come back in the order the rows were sent. */
export function siteBulkResultsByDirectory(
  rows: SiteBulkRow[],
  results: SiteBulkResult[]
): Record<string, SiteBulkResult> {
  const byDirectory: Record<string, SiteBulkResult> = {};
  for (const [index, row] of rows.entries()) {
    const result = results[index];
    if (result) {
      byDirectory[row.rootDirectory] = result;
    }
  }
  return byDirectory;
}

/**
 * A DOM id for one field of a row. The prefix keeps the repository root ("")
 * apart from a folder that happens to be named "root".
 */
export function siteBulkFieldId(
  idPrefix: string,
  rootDirectory: string,
  field: string
): string {
  return `${idPrefix}-bulk-${field}-d${encodeURIComponent(rootDirectory)}`;
}

/** A stable row key, distinct for the repository root and every folder. */
export function siteBulkRowKey(
  row: Pick<SiteBulkRow, "rootDirectory">
): string {
  return `d${encodeURIComponent(row.rootDirectory)}`;
}
