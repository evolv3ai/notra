"use client";

import { Cancel01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { COMPETITORS_TABLE_ROW_HEIGHT } from "@notra/geo-core/constants/geo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { DataTable, type TableColumn } from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { CompetitorLogo } from "@/components/geo/competitor-logo";
import { GEO_COMPETITORS_TABLE_VISIBLE_ROWS } from "@/constants/geo-competitors";
import {
  useGeoCompetitorIgnore,
  useGeoCompetitorRowNavigation,
} from "@/lib/hooks/use-geo";
import type { CompetitorSuggestionsTableProps } from "@/types/geo";
import type { GeoCompetitorSuggestion } from "@/types/geo-competitors";

export function CompetitorSuggestionsTable({
  suggestions,
  competitors,
  organizationId,
  organizationSlug,
  onTrack,
}: CompetitorSuggestionsTableProps) {
  const t = useTranslations("geo.competitorSuggestions");
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  const ignore = useGeoCompetitorIgnore(organizationId);
  const { openRow, prefetchRow } = useGeoCompetitorRowNavigation(
    organizationSlug,
    organizationId
  );

  if (suggestions.length === 0) {
    return null;
  }

  const columns: TableColumn<GeoCompetitorSuggestion>[] = [
    {
      key: "brand",
      header: tCommon("labels.brand"),
      sortable: true,
      width: "1fr",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-3">
          <CompetitorLogo
            className="size-7 shrink-0 rounded-md"
            competitors={competitors}
            name={row.brand}
          />
          <span className="truncate font-medium">{row.brand}</span>
        </span>
      ),
    },
    {
      key: "mentions",
      header: tGeoShared("mentionsLabel"),
      width: "16rem",
      sortable: true,
      collapsePriority: 1,
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">
          {row.mentions.toLocaleString(locale)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "8rem",
      align: "right",
      cell: (row) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            aria-label={t("trackNamed", { brand: row.brand })}
            onClick={(event) => {
              event.stopPropagation();
              onTrack(row.brand);
            }}
            size="xs"
            variant="outline"
          >
            <HugeiconsIcon
              data-icon="inline-start"
              icon={PlusSignIcon}
              strokeWidth={2}
            />
            {tGeoShared("track")}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("dismissNamed", { brand: row.brand })}
                  onClick={(event) => {
                    event.stopPropagation();
                    ignore.mutate({ name: row.brand, ignored: true });
                  }}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} />
            </TooltipTrigger>
            <TooltipContent>{t("dismiss")}</TooltipContent>
          </Tooltip>
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          {t("title")}
          <span className="text-muted-foreground font-normal tabular-nums">
            {suggestions.length.toLocaleString(locale)}
          </span>
        </h2>
        <p className="text-muted-foreground text-xs text-pretty">{t("hint")}</p>
      </div>
      <DataTable
        columns={columns}
        data={suggestions}
        defaultSort={{ key: "mentions", direction: "desc" }}
        getRowId={(row) => row.brand}
        height={
          (Math.min(suggestions.length, GEO_COMPETITORS_TABLE_VISIBLE_ROWS) +
            1) *
          COMPETITORS_TABLE_ROW_HEIGHT
        }
        onRowClick={(row) => openRow(row.brand)}
        onRowPointerEnter={(row) => prefetchRow(row.brand)}
        rowHeight={COMPETITORS_TABLE_ROW_HEIGHT}
      />
    </section>
  );
}
