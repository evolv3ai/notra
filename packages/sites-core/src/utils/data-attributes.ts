import { CAMEL_CASE_BOUNDARY } from "@notra/sites-core/constants/integrations";

export function dataAttributes(
  options: Record<string, unknown>
): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) {
      continue;
    }
    const name = key.replace(
      CAMEL_CASE_BOUNDARY,
      (letter) => `-${letter.toLowerCase()}`
    );
    attributes[`data-${name}`] =
      typeof value === "string" ? value : JSON.stringify(value);
  }
  return attributes;
}
