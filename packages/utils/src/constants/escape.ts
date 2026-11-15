export const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

export const HTML_SPECIAL_CHARACTERS = /[&<>"']/g;

export const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
