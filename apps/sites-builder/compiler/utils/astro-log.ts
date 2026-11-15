import { stripVTControlCharacters } from "node:util";

import { ASTRO_LOG_NOISE, SHIKI_UNKNOWN_LANGUAGE } from "../constants/build";

// Shiki warns once per code block, so one unknown fence language can flood
// the build log. Keep the first warning per language so typos stay visible.
export function createAstroLogFilter(): (text: string) => string {
  const reportedLanguages = new Set<string>();
  return (text) =>
    text
      .split("\n")
      .filter((line) => {
        const plain = stripVTControlCharacters(line);
        if (ASTRO_LOG_NOISE.some((pattern) => pattern.test(plain))) {
          return false;
        }
        const language = SHIKI_UNKNOWN_LANGUAGE.exec(plain)?.[1];
        if (language === undefined) {
          return true;
        }
        if (reportedLanguages.has(language)) {
          return false;
        }
        reportedLanguages.add(language);
        return true;
      })
      .join("\n");
}
