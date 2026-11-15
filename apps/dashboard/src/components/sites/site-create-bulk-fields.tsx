"use client";

import { GitBranchIcon } from "@hugeicons/core-free-icons";
import { SITE_BULK_IMPORT_MAX_SITES } from "@notra/schemas/constants/dashboard/sites";
import { Checkbox } from "@notra/ui/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import { Switch } from "@notra/ui/components/ui/switch";
import { m } from "motion/react";
import { useState } from "react";
import { DataTable, type TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { SiteAddressInput } from "@/components/sites/site-address-input";
import { SiteSuggestInput } from "@/components/sites/site-suggest-input";
import {
  SITE_BULK_ROW_HEIGHT,
  SITE_CREATE_ROW_VARIANTS,
} from "@/constants/site-create";
import { SITE_NAME_MAX_LENGTH } from "@/constants/sites-form";
import { cn } from "@/lib/utils";
import type { SiteCreateBulkFieldsProps } from "@/types/components/sites";
import type { SiteBulkRow } from "@/types/sites";
import { siteBulkFieldId, siteBulkRowKey } from "@/utils/site-create-bulk";
import { tableHeightFor } from "@/utils/table";

export function SiteCreateBulkFields({
  idPrefix: id,
  hostingDomain,
  branch,
  onBranchChange,
  branchLocked,
  repository,
  suggestions,
  rows,
  issues,
  onRowChange,
  onSelectAll,
  previewsEnabled,
  onPreviewsChange,
  disabled,
}: SiteCreateBulkFieldsProps) {
  const t = useTranslations("sites.new");
  const tSections = useTranslations("sites.sections");
  const [touchedSlugs, setTouchedSlugs] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const selectedCount = rows.filter((row) => row.selected).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;

  const folderOf = (row: SiteBulkRow) =>
    row.rootDirectory || t("bulk.rootFolder");
  const rowId = (row: SiteBulkRow, field: string) =>
    siteBulkFieldId(id, row.rootDirectory, field);
  const errorOf = (row: SiteBulkRow): string | null => {
    if (!row.selected) {
      return null;
    }
    const issue = issues[row.rootDirectory];
    if (issue === "duplicate") {
      return t("bulk.duplicate");
    }
    // Format errors wait for the first blur so typing doesn't shift the row.
    const touched = touchedSlugs.has(row.rootDirectory);
    if (touched && issue === "reserved") {
      return t("addressReserved", { slug: row.slug.trim().toLowerCase() });
    }
    if (touched && issue === "invalid") {
      return t("addressInvalid");
    }
    return row.result && "error" in row.result ? row.result.error : null;
  };
  const sectionsOf = (row: SiteBulkRow) =>
    [
      row.sections.blogPath
        ? `${tSections("blog")} ${row.sections.blogPath}`
        : null,
      row.sections.changelogPath
        ? `${tSections("changelog")} ${row.sections.changelogPath}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const columns: TableColumn<SiteBulkRow>[] = [
    {
      key: "selected",
      header: (
        <Checkbox
          aria-label={t("bulk.selectAll")}
          checked={allSelected}
          className="cursor-pointer"
          disabled={disabled}
          indeterminate={!allSelected && selectedCount > 0}
          onCheckedChange={(checked) => onSelectAll(checked)}
        />
      ),
      width: "2.75rem",
      minWidth: "2.75rem",
      cell: (row) => (
        <span className="flex h-8 items-center">
          <Checkbox
            aria-label={t("bulk.select", { folder: folderOf(row) })}
            checked={row.selected}
            className="cursor-pointer"
            disabled={disabled}
            onCheckedChange={(checked) =>
              onRowChange(row.rootDirectory, { selected: checked })
            }
          />
        </span>
      ),
    },
    {
      key: "name",
      header: t("bulk.columns.site"),
      width: "1fr",
      minWidth: "10rem",
      cell: (row) => (
        <span
          className={cn(
            "flex min-w-0 flex-col gap-1.5 py-1 transition-opacity",
            !row.selected && "opacity-50"
          )}
        >
          <label className="sr-only" htmlFor={rowId(row, "name")}>
            {t("bulk.nameLabel", { folder: folderOf(row) })}
          </label>
          <Input
            aria-invalid={row.selected && !row.name.trim() ? true : undefined}
            autoComplete="off"
            disabled={disabled}
            id={rowId(row, "name")}
            maxLength={SITE_NAME_MAX_LENGTH}
            onChange={(event) =>
              onRowChange(row.rootDirectory, { name: event.target.value })
            }
            required={row.selected}
            value={row.name}
          />
          <span className="text-muted-foreground min-w-0 truncate text-xs">
            <span className="font-mono">{folderOf(row)}</span>
            <span aria-hidden="true"> · </span>
            {sectionsOf(row)}
          </span>
        </span>
      ),
    },
    {
      key: "address",
      header: t("address"),
      width: "1.2fr",
      minWidth: "12rem",
      cell: (row) => {
        const error = errorOf(row);
        return (
          <span
            className={cn(
              "flex min-w-0 flex-col gap-1.5 py-1 transition-opacity",
              !row.selected && "opacity-50"
            )}
          >
            <label className="sr-only" htmlFor={rowId(row, "slug")}>
              {t("bulk.addressLabel", { folder: folderOf(row) })}
            </label>
            <SiteAddressInput
              describedBy={error ? rowId(row, "error") : undefined}
              disabled={disabled}
              hostingDomain={hostingDomain}
              id={rowId(row, "slug")}
              invalid={Boolean(error)}
              onBlur={() =>
                setTouchedSlugs((prev) =>
                  prev.has(row.rootDirectory)
                    ? prev
                    : new Set(prev).add(row.rootDirectory)
                )
              }
              onValueChange={(value) =>
                onRowChange(row.rootDirectory, { slug: value })
              }
              placeholder="acme"
              value={row.slug}
            />
            <FieldError id={rowId(row, "error")}>{error}</FieldError>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <m.div variants={SITE_CREATE_ROW_VARIANTS}>
        <Field>
          <FieldLabel htmlFor={`${id}-branch`}>{t("branch")}</FieldLabel>
          <SiteSuggestInput
            emptyLabel={t("noBranchMatch")}
            icon={GitBranchIcon}
            id={`${id}-branch`}
            onValueChange={onBranchChange}
            placeholder={repository?.defaultBranch ?? "main"}
            disabled={branchLocked}
            suggestions={suggestions.branches}
            value={branch}
          />
        </Field>
      </m.div>
      <m.div variants={SITE_CREATE_ROW_VARIANTS}>
        <DataTable
          columns={columns}
          data={rows}
          getRowId={siteBulkRowKey}
          height={tableHeightFor(rows.length, SITE_BULK_ROW_HEIGHT)}
          loading={suggestions.isLoading}
          rowSizing="content"
          scrollFade
        />
        {selectedCount > SITE_BULK_IMPORT_MAX_SITES ? (
          <FieldError className="mt-2">
            {t("bulk.tooMany", { max: SITE_BULK_IMPORT_MAX_SITES })}
          </FieldError>
        ) : null}
      </m.div>
      <m.div variants={SITE_CREATE_ROW_VARIANTS}>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${id}-bulk-previews`}>
              {t("bulk.previews")}
            </FieldLabel>
            <FieldDescription>{t("bulk.previewsHint")}</FieldDescription>
          </FieldContent>
          <Switch
            checked={previewsEnabled}
            disabled={disabled}
            id={`${id}-bulk-previews`}
            onCheckedChange={onPreviewsChange}
          />
        </Field>
      </m.div>
    </>
  );
}
