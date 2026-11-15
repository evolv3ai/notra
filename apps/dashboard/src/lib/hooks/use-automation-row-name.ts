import { useTranslations } from "use-intl";

import { useOutputTypeLabel } from "@/lib/hooks/use-output-type-label";
import type { AutomationRow } from "@/types/automation/automations";

/** Event triggers have no name of their own, so they're named by what they do. */
export function useAutomationRowName() {
  const t = useTranslations("automation.page");
  const tCommon = useTranslations("common");
  const tEvents = useTranslations("automation.events.page");
  const outputTypeLabel = useOutputTypeLabel();

  return (row: AutomationRow) => {
    if (row.kind === "alert") {
      return row.alert.name;
    }
    if (row.kind === "schedule") {
      return row.trigger.name;
    }
    const events = row.trigger.sourceConfig.eventTypes ?? [];
    return t("eventRowName", {
      event: events
        .map((event) =>
          event === "release"
            ? tCommon("labels.release")
            : tEvents("eventNames.push")
        )
        .join(", "),
      output: outputTypeLabel(row.trigger.outputType),
    });
  };
}
