import type { OutreachVariable } from "../types/outreach";

export const fillTemplate = (text: string, variables: OutreachVariable[]) =>
  text.replaceAll(
    /\{\{(\w+)\}\}/g,
    (match, key: string) =>
      variables.find((variable) => variable.key === key)?.value ?? match
  );

export const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();
