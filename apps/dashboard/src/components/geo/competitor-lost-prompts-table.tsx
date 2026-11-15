"use client";

import { COMPETITORS_TABLE_ROW_HEIGHT } from "@notra/geo-core/constants/geo";
import { promptIdFromScanId } from "@notra/geo-core/geo/prompts";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { DataTable, type TableColumn } from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import { EngineIcon } from "@/components/geo/engine-icon";
import { PromptMentionedInsteadCell } from "@/components/geo/prompt-mentioned-instead-cell";
import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { GEO_COMPETITORS_TABLE_VISIBLE_ROWS } from "@/constants/geo-competitors";
import { GEO_PROMPT_DETAIL_QUERY_KEY } from "@/constants/geo-prompts";
import { useRouter } from "@/lib/navigation";
import type {
  CompetitorLostPromptsTableProps,
  GeoLostPromptRow,
} from "@/types/geo";
import { withGeoProject } from "@/utils/geo-paths";
import { buildLostPromptRows } from "@/utils/geo-prompts";

export function CompetitorLostPromptsTable({
  results,
  competitors,
  organizationSlug,
  rangeParam,
}: CompetitorLostPromptsTableProps) {
  const t = useTranslations("geo.competitorLostPrompts");
  const tPrompts = useTranslations("geo.promptsTable");
  const locale = useLocale();
  const router = useRouter();
  const { projectId } = useGeoProjectScope();
  const rows = buildLostPromptRows(results);

  const openPrompt = (row: GeoLostPromptRow) => {
    const params = new URLSearchParams({
      [GEO_PROMPT_DETAIL_QUERY_KEY]: promptIdFromScanId(row.promptId),
    });
    if (rangeParam) {
      params.set("range", rangeParam);
    }
    router.push(
      withGeoProject(
        `/${organizationSlug}/geo/prompts?${params.toString()}`,
        projectId
      )
    );
  };

  if (rows.length === 0) {
    return null;
  }

  const columns: TableColumn<GeoLostPromptRow>[] = [
    {
      key: "prompt",
      header: t("prompt"),
      sortable: true,
      width: "1fr",
      cell: (row) => (
        <TruncateWithTooltip className="font-medium">
          {row.prompt}
        </TruncateWithTooltip>
      ),
    },
    {
      key: "lost",
      header: t("missingIn"),
      width: "12rem",
      sortable: true,
      collapsePriority: 2,
      sortValue: (row) => row.lost,
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            {row.lostEngines.map((engine) => (
              <EngineIcon className="size-4" engine={engine} key={engine} />
            ))}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {t("answers", { lost: row.lost, total: row.answers })}
          </span>
        </span>
      ),
    },
    {
      key: "brands",
      header: tPrompts("columns.mentionedInstead"),
      width: "18rem",
      collapsePriority: 1,
      cell: (row) => (
        <PromptMentionedInsteadCell
          answers={row.lost}
          brands={row.brands}
          competitors={competitors}
        />
      ),
    },
  ];

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          {t("title")}
          <span className="text-muted-foreground font-normal tabular-nums">
            {rows.length.toLocaleString(locale)}
          </span>
        </h2>
        <p className="text-muted-foreground text-xs text-pretty">{t("hint")}</p>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        defaultSort={{ key: "lost", direction: "desc" }}
        getRowId={(row) => row.promptId}
        height={
          (Math.min(rows.length, GEO_COMPETITORS_TABLE_VISIBLE_ROWS) + 1) *
          COMPETITORS_TABLE_ROW_HEIGHT
        }
        onRowClick={openPrompt}
        rowHeight={COMPETITORS_TABLE_ROW_HEIGHT}
      />
    </section>
  );
}
