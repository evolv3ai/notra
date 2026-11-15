/** Preserve font URLs and weights without repeating the same variable font URL. */
export function compactOgStyleguide(
  styleguide: Record<string, unknown>
): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(styleguide, (key, value: unknown) => {
      if (key === "fontFallbacks") {
        return undefined;
      }
      if (
        key !== "files" ||
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        return value;
      }
      const files = Object.entries(value);
      if (!files.every(([, url]) => typeof url === "string")) {
        return value;
      }
      return [...new Set(files.map(([, url]) => url))].map((url) => ({
        url,
        weights: files
          .filter(([, source]) => source === url)
          .map(([weight]) => weight),
      }));
    })
  );
}
