import type { SiteManifest } from "@notra/sites-core/types/deployment";
import {
  joinMountPath,
  listMountedAreas,
} from "@notra/sites-core/utils/mounts";

import { ROBOTS_TXT_MAX_AGE_SECONDS } from "../constants/responses";

export function sitemapIndex(origin: string, manifest: SiteManifest): Response {
  const entries = listMountedAreas(manifest.target.mounts).map(
    ({ mount }) =>
      `  <sitemap><loc>${origin}${joinMountPath(mount, "sitemap.xml")}</loc></sitemap>`
  );
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</sitemapindex>",
  ];
  return new Response(`${body.join("\n")}\n`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${ROBOTS_TXT_MAX_AGE_SECONDS}`,
    },
  });
}
