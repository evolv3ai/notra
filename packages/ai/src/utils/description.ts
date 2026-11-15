import type { ToolDescription } from "@notra/ai/types/tools";
import dedent from "dedent";

const SECTIONS = [
  ["intro", ""],
  ["whenToUse", "Use when: "],
  ["whenNotToUse", "Do not use when: "],
  ["usageNotes", "Notes: "],
] as const;

export const toolDescription = (input: ToolDescription) =>
  SECTIONS.flatMap(([key, label]) => {
    const value = input[key];
    const text = value ? dedent(value) : "";
    return text ? [`${label}${text}`] : [];
  }).join("\n");
