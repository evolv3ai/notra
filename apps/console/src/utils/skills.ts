import type { SystemSkillAdoption } from "@notra/ai/skills/types";

import { systemSkillNameInputSchema } from "@/schemas/skills";

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const SKILL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

export function formatSkillDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, SKILL_DATE_FORMAT);
}

export function parseSystemSkillName(segment: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  const parsed = systemSkillNameInputSchema.safeParse({ name: decoded });
  return parsed.success ? parsed.data.name : null;
}

export function publishSummary(adoption: SystemSkillAdoption | null) {
  if (!adoption) {
    return "Every workspace without a skill of this name gets it right away.";
  }
  const automatic = adoption.copies - adoption.customized;
  return `${countLabel(automatic, "workspace updates", "workspaces update")} right away. ${countLabel(adoption.customized, "customized copy keeps its text and gets", "customized copies keep their text and get")} an update notice.`;
}
