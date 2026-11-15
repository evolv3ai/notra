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
import { Streamdown } from "streamdown";

import { GEO_INTENT_LABELS } from "@/constants/geo-report";
import type { PromptGridProps } from "@/types/geo-report";
import { countMentions } from "@/utils/geo-report";

import { BrandLogo } from "./brand-logo";

const LOGO_SIZE_MODEL = 20;
const TOP_RANK = 1;
const GOOD_RANK_MAX = 3;

type RankBand = "top" | "good" | "low";

function rankBand(rank: number): RankBand {
  if (rank === TOP_RANK) {
    return "top";
  }
  return rank <= GOOD_RANK_MAX ? "good" : "low";
}

const RANK_CLASS: Record<RankBand, string> = {
  top: "bg-emerald-600 text-white",
  good: "bg-emerald-400 text-emerald-950",
  low: "bg-amber-400 text-amber-950",
};

const ABSENT_CLASS = "border border-red-300 text-red-500";

const RANK_LEGEND = [
  { sample: "1", label: "Named first", className: RANK_CLASS.top },
  { sample: "2", label: "In the top three", className: RANK_CLASS.good },
  { sample: "4", label: "Further down the answer", className: RANK_CLASS.low },
  { sample: "–", label: "Not mentioned", className: ABSENT_CLASS },
] as const;

interface OpenCell {
  promptId: string;
  modelId: string;
}

/** The prompt × model grid. Cells with a stored answer open it in a dialog. */
export function PromptGrid({ report, models }: PromptGridProps) {
  const modelIds = models.map((model) => model.id);
  const [open, setOpen] = useState<OpenCell | null>(null);

  const openPrompt = report.prompts.find(
    (prompt) => prompt.id === open?.promptId
  );
  const openAnswer = open ? openPrompt?.answers?.[open.modelId] : undefined;

  return (
    <>
      <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-(--geo-muted)">
        {RANK_LEGEND.map((item) => (
          <li className="flex items-center gap-2" key={item.label}>
            <span
              className={cn(
                "flex h-5 w-6 items-center justify-center rounded text-[10px] font-medium",
                item.className
              )}
            >
              {item.sample}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] table-fixed border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr>
              <th className="pb-2 text-left text-xs font-medium text-(--geo-muted)">
                Prompt
              </th>
              {models.map((model) => (
                <th
                  className="w-[5.5rem] min-w-[5.5rem] pb-2 align-bottom font-normal"
                  key={model.id}
                >
                  <span className="flex flex-col items-center gap-1.5">
                    <BrandLogo
                      domain={model.providerDomain}
                      name={model.provider}
                      size={LOGO_SIZE_MODEL}
                    />
                    <span
                      className="w-full truncate px-1 text-center text-[11px] leading-none text-(--geo-muted)"
                      title={model.name}
                    >
                      {model.name}
                    </span>
                  </span>
                </th>
              ))}
              <th className="w-24 pb-2 pl-3 text-right text-xs font-medium whitespace-nowrap text-(--geo-muted)">
                Mentioned by
              </th>
            </tr>
          </thead>
          <tbody>
            {report.prompts.map((prompt) => (
              <tr key={prompt.id}>
                <td className="pr-4 leading-snug">
                  <button
                    className="cursor-pointer text-left underline-offset-2 hover:underline"
                    onClick={() =>
                      setOpen({
                        promptId: prompt.id,
                        modelId:
                          modelIds.find((id) => prompt.answers?.[id]) ??
                          modelIds[0] ??
                          "",
                      })
                    }
                    type="button"
                  >
                    {prompt.text}
                  </button>
                  <span className="mt-0.5 block text-xs text-(--geo-muted)">
                    {GEO_INTENT_LABELS[prompt.intent]}
                  </span>
                </td>
                {models.map((model) => {
                  const rank = prompt.ranks[model.id];
                  const cellClass = cn(
                    "mx-auto flex h-8 w-9 items-center justify-center rounded-md text-xs tabular-nums",
                    rank == null ? ABSENT_CLASS : RANK_CLASS[rankBand(rank)],
                    rank != null && "font-medium"
                  );
                  return (
                    <td className="w-[5.5rem] text-center" key={model.id}>
                      <button
                        aria-label={`Open ${model.name}'s answer to ${prompt.text}: ${prompt.ranks[model.id] == null ? "not mentioned" : `rank ${prompt.ranks[model.id]}`}`}
                        className={cn(
                          cellClass,
                          "cursor-pointer transition-transform hover:scale-110 hover:ring-2 hover:ring-(--geo-violet)/40"
                        )}
                        onClick={() =>
                          setOpen({ promptId: prompt.id, modelId: model.id })
                        }
                        type="button"
                      >
                        {rank ?? "–"}
                      </button>
                    </td>
                  );
                })}
                <td className="pl-3 text-right text-xs text-(--geo-muted) tabular-nums">
                  {countMentions(prompt, modelIds)}/{modelIds.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ResponsiveDialog
        onOpenChange={(next) => {
          if (!next) {
            setOpen(null);
          }
        }}
        open={open !== null}
      >
        <ResponsiveDialogContent className="sm:max-w-2xl">
          {openPrompt ? (
            <>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>{openPrompt.text}</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  How each model answered.{" "}
                  {GEO_INTENT_LABELS[openPrompt.intent]} question.
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <div
                aria-label="Model"
                className="flex flex-wrap gap-1.5 py-1"
                role="tablist"
              >
                {models.map((model) => {
                  const rank = openPrompt.ranks[model.id] ?? null;
                  const selected = open?.modelId === model.id;
                  return (
                    <button
                      aria-selected={selected}
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      key={model.id}
                      onClick={() =>
                        setOpen({
                          promptId: openPrompt.id,
                          modelId: model.id,
                        })
                      }
                      role="tab"
                      type="button"
                    >
                      <BrandLogo
                        domain={model.providerDomain}
                        name={model.provider}
                        size={14}
                      />
                      {model.name}
                      <span
                        className={cn(
                          "tabular-nums",
                          rank === null ? "text-red-500" : "text-emerald-600"
                        )}
                      >
                        {rank === null ? "–" : `#${rank}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="max-h-[55svh] overflow-y-auto py-2 text-sm">
                {openAnswer ? (
                  <Streamdown className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                    {openAnswer.text}
                  </Streamdown>
                ) : (
                  <p className="text-muted-foreground">
                    No stored answer for this model yet. Run the scan to capture
                    it.
                  </p>
                )}
                {openAnswer && openAnswer.sources.length > 0 ? (
                  <div className="mt-5 border-t pt-3">
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      Sources cited
                    </p>
                    <ul className="grid gap-1">
                      {openAnswer.sources.map((source) => (
                        <li key={source.url}>
                          <a
                            className="text-primary block truncate underline-offset-2 hover:underline"
                            href={source.url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {source.title || source.url}
                          </a>
                        </li>
                      ))}
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
