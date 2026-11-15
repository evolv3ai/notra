"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";

import type { CompetitorRowsProps, GeoCompetitorRow } from "@/types/geo-report";
import { countMentions, formatPercent } from "@/utils/geo-report";

import { BrandLogo } from "./brand-logo";

const LOGO_SIZE_ROW = 24;
const LOGO_SIZE_DIALOG = 40;
const PERCENT = 100;

function ShareBar({
  fraction,
  tone,
}: Pick<GeoCompetitorRow, "fraction" | "tone">) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-(--geo-paper-deep)">
      <span
        className={cn(
          "block h-full rounded-full",
          tone === "brand" && "bg-(--geo-violet)",
          tone === "ahead" && "bg-red-500",
          tone === "behind" && "bg-emerald-500",
          tone === "tied" && "bg-(--geo-muted)"
        )}
        style={{ width: `${Math.round(fraction * PERCENT)}%` }}
      />
    </span>
  );
}

/** Share-of-voice rows; each opens a dialog with the detail behind the number. */
export function CompetitorRows({ report, models }: CompetitorRowsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const modelIds = models.map((model) => model.id);
  const brandShare = report.summary.shareOfVoice;

  const rows: GeoCompetitorRow[] = [
    {
      id: "self",
      domain: report.company.domain,
      name: report.company.name,
      note: "This report",
      fraction: brandShare,
      tone: "brand",
    },
    ...report.competitors.map((competitor) => ({
      id: competitor.id,
      domain: competitor.domain,
      name: competitor.name,
      note: competitor.winsOn,
      fraction: competitor.shareOfVoice,
      tone: (competitor.shareOfVoice === brandShare
        ? "tied"
        : competitor.shareOfVoice > brandShare
          ? "ahead"
          : "behind") as GeoCompetitorRow["tone"],
    })),
  ];

  const active = rows.find((row) => row.id === openId);
  const activeCompetitor = report.competitors.find(
    (competitor) => competitor.id === openId
  );
  const heldPrompts = report.opportunities.filter((opportunity) =>
    openId ? opportunity.occupiedBy.includes(openId) : false
  );

  return (
    <>
      <ul className="divide-y divide-(--geo-line)">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_3rem] items-center gap-4 rounded-lg py-3.5 text-left transition-colors hover:bg-(--geo-paper-deep)/60 sm:grid-cols-[auto_14rem_minmax(0,1fr)_3rem] sm:px-2"
              onClick={() => setOpenId(row.id)}
              type="button"
            >
              <BrandLogo
                domain={row.domain}
                name={row.name}
                size={LOGO_SIZE_ROW}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{row.name}</span>
                <span className="block truncate text-xs text-(--geo-muted)">
                  {row.note}
                </span>
              </span>
              <span className="col-span-3 sm:col-span-1">
                <ShareBar fraction={row.fraction} tone={row.tone} />
              </span>
              <span
                className={cn(
                  "col-start-3 row-start-1 text-right text-sm tabular-nums sm:col-start-auto sm:row-start-auto",
                  row.tone === "ahead" && "text-red-600",
                  row.tone === "behind" && "text-emerald-700"
                )}
              >
                {formatPercent(row.fraction)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ResponsiveDialog
        onOpenChange={(open) => {
          if (!open) {
            setOpenId(null);
          }
        }}
        open={openId !== null}
      >
        <ResponsiveDialogContent className="sm:max-w-lg">
          {active ? (
            <>
              <ResponsiveDialogHeader>
                <div className="flex items-center gap-3">
                  <BrandLogo
                    domain={active.domain}
                    name={active.name}
                    size={LOGO_SIZE_DIALOG}
                  />
                  <div>
                    <ResponsiveDialogTitle>{active.name}</ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                      {formatPercent(active.fraction)} share of voice
                      {activeCompetitor
                        ? ` · mentioned in ${formatPercent(activeCompetitor.mentionRate)} of answers`
                        : ""}
                    </ResponsiveDialogDescription>
                  </div>
                </div>
              </ResponsiveDialogHeader>
              <div className="flex flex-col gap-5 py-2 text-sm">
                {activeCompetitor?.winsOn ? (
                  <p className="text-muted-foreground">
                    {activeCompetitor.winsOn}
                  </p>
                ) : null}
                {activeCompetitor && heldPrompts.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      Shelf it holds instead of {report.company.name}
                    </p>
                    <ul className="divide-y">
                      {heldPrompts.map((opportunity) => (
                        <li className="py-2" key={opportunity.id}>
                          {opportunity.prompt}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {active.id === "self" ? (
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      Mentions per prompt
                    </p>
                    <ul className="divide-y">
                      {report.prompts.map((prompt) => {
                        const hits = countMentions(prompt, modelIds);
                        return (
                          <li
                            className="flex items-center justify-between gap-4 py-2"
                            key={prompt.id}
                          >
                            <span className="min-w-0 truncate">
                              {prompt.text}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 tabular-nums",
                                hits === 0 && "text-red-600",
                                hits > 0 &&
                                  hits < modelIds.length &&
                                  "text-amber-600",
                                hits === modelIds.length && "text-emerald-700"
                              )}
                            >
                              {hits}/{modelIds.length}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
