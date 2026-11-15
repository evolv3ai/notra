"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { DataTable, type TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { SiteCreateDeployHeading } from "@/components/sites/site-create-deploy-heading";
import {
  SITE_BULK_ROW_HEIGHT,
  SITE_CREATE_DEPLOY_TONE_ICONS,
} from "@/constants/site-create";
import type { SiteCreateBulkResultsProps } from "@/types/components/sites";
import type { SiteBulkRow } from "@/types/sites";
import { siteBulkRowKey } from "@/utils/site-create-bulk";
import { siteHref } from "@/utils/site-links";
import { tableHeightFor } from "@/utils/table";

export function SiteCreateBulkResults({
  organizationSlug,
  rows,
  isRetrying,
  onRetry,
  onEdit,
}: SiteCreateBulkResultsProps) {
  const t = useTranslations("sites.new.bulk");
  const failedCount = rows.filter(
    (row) => row.result && "error" in row.result
  ).length;
  const createdCount = rows.length - failedCount;

  const columns: TableColumn<SiteBulkRow>[] = [
    {
      key: "name",
      header: t("columns.site"),
      width: "1fr",
      minWidth: "10rem",
      cell: (row) => (
        <span className="flex min-h-10 min-w-0 flex-col justify-center gap-0.5">
          <span className="truncate font-medium">
            {row.result && "site" in row.result
              ? row.result.site.name
              : row.name}
          </span>
          <span className="text-muted-foreground truncate font-mono text-xs">
            {row.rootDirectory || t("rootFolder")}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      width: "1.2fr",
      minWidth: "10rem",
      cell: (row) => {
        if (!row.result) {
          return null;
        }
        if ("error" in row.result) {
          return (
            <span className="flex min-h-10 items-center gap-2 py-2 text-sm">
              <HugeiconsIcon
                aria-hidden="true"
                className="text-destructive size-4 shrink-0"
                icon={SITE_CREATE_DEPLOY_TONE_ICONS.error}
                strokeWidth={1.75}
              />
              <span className="[overflow-wrap:anywhere]">
                {row.result.error}
              </span>
            </span>
          );
        }
        const { site } = row.result;
        return (
          <span className="flex min-h-10 items-center justify-between gap-3">
            <span className="text-success inline-flex items-center gap-2 text-sm">
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4 shrink-0"
                icon={SITE_CREATE_DEPLOY_TONE_ICONS.success}
                strokeWidth={1.75}
              />
              {t("created")}
            </span>
            <Link
              aria-label={t("openSite", { name: site.name })}
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={siteHref(
                organizationSlug,
                site.id,
                "overview",
                site.projectId
              )}
            >
              {t("open")}
            </Link>
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <SiteCreateDeployHeading
          headline={t("summary", { created: createdCount, total: rows.length })}
          tone={failedCount > 0 ? "error" : "success"}
        />
      </p>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={siteBulkRowKey}
        height={tableHeightFor(rows.length, SITE_BULK_ROW_HEIGHT)}
        rowSizing="content"
      />
      {failedCount > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            disabled={isRetrying}
            onClick={onEdit}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("edit")}
          </Button>
          <Button
            loading={isRetrying}
            onClick={onRetry}
            size="sm"
            type="button"
          >
            {t("retry", { count: failedCount })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
