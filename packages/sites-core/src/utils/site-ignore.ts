import ignore from "ignore";

import { SITE_CONFIG_FILENAME } from "../constants/sites";
import { SITE_IGNORE_FILENAME } from "../constants/source";

export function createSiteIgnore(content = "") {
  const matcher = ignore({ ignorecase: false }).add(content);
  return (path: string): boolean =>
    path !== SITE_CONFIG_FILENAME &&
    path !== SITE_IGNORE_FILENAME &&
    matcher.ignores(path);
}

export function filterSiteFiles(files: ReadonlyMap<string, string | null>) {
  const isIgnored = createSiteIgnore(files.get(SITE_IGNORE_FILENAME) ?? "");
  return new Map(
    [...files].filter(
      ([path]) => path !== SITE_IGNORE_FILENAME && !isIgnored(path)
    )
  );
}
