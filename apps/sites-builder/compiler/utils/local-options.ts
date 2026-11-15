import { basename } from "node:path";

import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteBuildRequest } from "@notra/sites-core/types/build";
import { createDefaultSiteConfig } from "@notra/sites-core/utils/default-config";

export function localDefaultConfig(
  siteRoot: string,
  target?: SiteBuildRequest
) {
  return (
    target?.defaultConfig ??
    createDefaultSiteConfig(
      basename(siteRoot)
        .trim()
        .slice(0, siteConfigSchema.shape.name.maxLength ?? 80)
        .trim() || "Local site"
    )
  );
}
