import {
  HTML_ENTITIES,
  HTML_SPECIAL_CHARACTERS,
  REGEXP_SPECIAL_CHARACTERS,
} from "@notra/utils/constants/escape";

export function escapeRegExp(value: string): string {
  return value.replace(REGEXP_SPECIAL_CHARACTERS, "\\$&");
}

export function escapeHtml(value: string): string {
  return value.replace(
    HTML_SPECIAL_CHARACTERS,
    (char) => HTML_ENTITIES[char] ?? char
  );
}
