import type { AutomationRunCursor } from "@/types/automation/runs";

export function encodeAutomationRunCursor(run: {
  startedAt: Date;
  id: string;
}): string {
  return `${run.startedAt.toISOString()}|${run.id}`;
}

export function decodeAutomationRunCursor(
  cursor: string
): AutomationRunCursor | null {
  const separatorIndex = cursor.indexOf("|");
  if (separatorIndex <= 0) {
    return null;
  }
  const startedAt = new Date(cursor.slice(0, separatorIndex));
  const id = cursor.slice(separatorIndex + 1);
  if (Number.isNaN(startedAt.getTime()) || id.length === 0) {
    return null;
  }
  return { startedAt, id };
}
