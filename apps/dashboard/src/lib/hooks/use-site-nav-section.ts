import { parseAsString, useQueryState } from "nuqs";

import { SITE_NAV_SECTIONS, SITE_SECTIONS } from "@/constants/sites";
import { usePathname } from "@/lib/navigation";
import type { SiteSection } from "@/types/sites";
import { siteHref } from "@/utils/site-links";

/** Pages without their own nav row highlight the row that links to them. */
function navSection(section: SiteSection): SiteSection {
  if (SITE_NAV_SECTIONS.has(section)) {
    return section;
  }
  return section === "integrations" ? "settings" : "overview";
}

/** The site page being shown, and the nav row that should look current. */
export function useSiteNavSection(slug: string, siteId: string) {
  const pathname = usePathname();
  const [branch] = useQueryState("branch", parseAsString);
  const rest = pathname.slice(siteHref(slug, siteId).length);
  const current =
    SITE_SECTIONS.find(
      (item) =>
        item.path && (rest === item.path || rest.startsWith(`${item.path}/`))
    )?.section ?? "overview";
  return { current, section: navSection(current), branch };
}
