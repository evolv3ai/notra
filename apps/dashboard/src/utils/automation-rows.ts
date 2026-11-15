import type { AutomationRow } from "@/types/automation/automations";

export function rowEnabled(row: AutomationRow) {
  return row.kind === "alert" ? row.alert.enabled : row.trigger.enabled;
}
