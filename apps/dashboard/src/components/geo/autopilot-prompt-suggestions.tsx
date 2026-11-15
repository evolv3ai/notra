"use client";

import { InstrumentModule } from "ui/card";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  useGeoAutopilotPromptSuggestionAction,
  useGeoAutopilotPromptSuggestions,
} from "@/lib/hooks/use-geo";

/** Autopilot's suggested changes to tracked prompts; hidden when there are none. */
export function AutopilotPromptSuggestions({
  organizationId,
}: {
  organizationId: string;
}) {
  const t = useTranslations("geo.autopilotPromptSuggestions");
  const { data } = useGeoAutopilotPromptSuggestions(organizationId);
  const action = useGeoAutopilotPromptSuggestionAction(organizationId);
  const suggestions = data?.suggestions ?? [];
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <InstrumentModule
      bodyClassName="p-0"
      eyebrow={t("eyebrow")}
      readout={<span>{t("readout")}</span>}
      variant="table"
    >
      {suggestions.map((suggestion) => {
        const busy =
          action.isPending && action.variables?.suggestionId === suggestion.id;
        return (
          <div
            className="flex flex-col gap-3 border-b px-5 py-4 last:border-b-0 sm:flex-row sm:items-center"
            key={suggestion.id}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium wrap-anywhere">
                {suggestion.prompt}
              </span>
              {suggestion.reasonData?.kind === "no_brands" ? (
                <span className="text-muted-foreground text-xs text-pretty">
                  {t("reasonNoBrands", {
                    answers: suggestion.reasonData.answers,
                    days: suggestion.reasonData.lookbackDays,
                  })}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                disabled={busy}
                onClick={() =>
                  action.mutate({ suggestionId: suggestion.id, action: "keep" })
                }
                size="xs"
                variant="ghost"
              >
                {t("keep")}
              </Button>
              <Button
                disabled={busy}
                loading={busy && action.variables?.action === "pause"}
                onClick={() =>
                  action.mutate({
                    suggestionId: suggestion.id,
                    action: "pause",
                  })
                }
                size="xs"
                variant="outline"
              >
                {t("pause")}
              </Button>
            </div>
          </div>
        );
      })}
    </InstrumentModule>
  );
}
