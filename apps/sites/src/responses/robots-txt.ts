import type { SiteManifest } from "@notra/sites-core/types/deployment";
import {
  joinMountPath,
  listMountedAreas,
} from "@notra/sites-core/utils/mounts";

import {
  AI_USER_AGENTS,
  ROBOTS_TXT_MAX_AGE_SECONDS,
} from "../constants/responses";
import { plainText } from "../utils/responses";

export function robotsTxt(
  origin: string,
  crawlable: SiteManifest | null,
  mount = "/"
): Response {
  const lines = crawlable
    ? [
        `# Markdown map of this site for language models: ${origin}${joinMountPath(mount, "llms.txt")}`,
        "User-agent: *",
        "Allow: /",
        "",
        ...AI_USER_AGENTS.map((agent) => `User-agent: ${agent}`),
        "Allow: /",
        "",
        ...(mount === "/"
          ? listMountedAreas(crawlable.target.mounts).map((area) => area.mount)
          : [mount]
        ).map(
          (sitemapMount) =>
            `Sitemap: ${origin}${joinMountPath(sitemapMount, "sitemap.xml")}`
        ),
      ]
    : ["User-agent: *", "Disallow: /"];
  return plainText(`${lines.join("\n")}\n`, ROBOTS_TXT_MAX_AGE_SECONDS);
}
