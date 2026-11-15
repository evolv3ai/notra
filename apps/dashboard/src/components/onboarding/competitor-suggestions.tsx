"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { CompetitorChoiceRow } from "@/components/onboarding/competitor-choice-row";
import { CompetitorSuggestionsSkeleton } from "@/components/onboarding/competitor-suggestions-skeleton";
import { ONBOARDING_VISIBLE_SUGGESTIONS } from "@/constants/onboarding";
import type { CompetitorSuggestionsProps } from "@/types/onboarding";
import { findCompetitor } from "@/utils/onboarding-competitors";

export function CompetitorSuggestions({
  domain,
  suggestions,
  competitors,
  remainingCount,
  busy,
  atLimit,
  onAdd,
  onRemove,
  onAddAll,
}: CompetitorSuggestionsProps) {
  const t = useTranslations("onboarding.competitors");
  const tCommon = useTranslations("common");
  const [showAll, setShowAll] = useState(false);
  const suggested = suggestions.data?.competitors ?? [];
  const visible = showAll
    ? suggested
    : suggested.slice(0, ONBOARDING_VISIBLE_SUGGESTIONS);
  const hiddenCount = suggested.length - visible.length;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium">
          {t("suggestedFor", { domain })}
        </p>
        {remainingCount > 1 ? (
          <Button
            className="text-muted-foreground h-auto px-0"
            disabled={busy || atLimit}
            onClick={onAddAll}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("addAll")}
          </Button>
        ) : null}
      </div>
      {suggestions.data?.field ? (
        <p className="text-muted-foreground -mt-1 text-xs">
          {t("otherCompaniesIn", { field: suggestions.data.field })}
        </p>
      ) : null}
      {suggestions.isPending ? <CompetitorSuggestionsSkeleton /> : null}
      {suggestions.isError ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground min-w-0 text-xs wrap-anywhere">
            {t("suggestionsFailed", { domain })}
          </p>
          <Button
            className="h-auto shrink-0 px-0"
            disabled={busy || suggestions.isFetching}
            onClick={() => {
              suggestions.refetch();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {suggestions.isFetching
              ? t("tryingAgain")
              : tCommon("actions.tryAgain")}
          </Button>
        </div>
      ) : null}
      {suggestions.isSuccess && suggested.length === 0 ? (
        <p className="text-muted-foreground text-xs wrap-anywhere">
          {t("noSuggestions", { domain })}
        </p>
      ) : null}
      {suggested.length > 0 ? (
        <ul className="w-full max-w-full min-w-0 space-y-1.5 overflow-hidden">
          {visible.map((entry) => {
            const existing = findCompetitor(
              competitors,
              entry.domain,
              entry.name
            );
            return (
              <CompetitorChoiceRow
                description={entry.description}
                disabled={busy || (atLimit && !existing)}
                domain={entry.domain}
                key={entry.domain ?? entry.name}
                name={entry.name}
                onToggle={() =>
                  existing
                    ? onRemove(existing)
                    : onAdd(entry.name, entry.domain)
                }
                selected={existing !== undefined}
              />
            );
          })}
        </ul>
      ) : null}
      {hiddenCount > 0 ? (
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => setShowAll(true)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {t("showMore", { count: hiddenCount })}
        </Button>
      ) : null}
    </div>
  );
}
