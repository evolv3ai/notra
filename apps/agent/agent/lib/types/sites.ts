import type { createGetSiteContentTool } from "@notra/tools/assistant/get-site-content";
import type { createGetSitesTool } from "@notra/tools/assistant/get-sites";

interface SiteToolActivityLabel {
  label: { start: () => string };
}

export type PublicSitesTool = ReturnType<typeof createGetSitesTool> &
  SiteToolActivityLabel;
export type PublicSiteContentTool = ReturnType<
  typeof createGetSiteContentTool
> &
  SiteToolActivityLabel;
