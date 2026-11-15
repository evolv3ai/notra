import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import {
  ANALYTICS_NAV_LINK,
  DEFAULT_NAV_VISIBILITY,
  GEO_OVERVIEW_NAV_LINK,
  GEO_ROUTE_SECTIONS,
  NAV_GEO_IMPROVE_LINKS,
  NAV_MAIN_ITEMS,
  SHARED_ROUTE_PREFIXES,
  SIDEBAR_DEFAULT_MODE,
  STUDIO_ROUTE_SECTIONS,
} from "@/constants/nav";
import { SITES_NAV_LINK } from "@/constants/sites";
import type {
  NavGroup,
  NavGroupRowState,
  NavMainItem,
  NavVisibility,
  SidebarMode,
} from "@/types/components/nav";
import type { SettingsUrlSearchParams } from "@/types/settings/modal";

import { geoNavHref } from "./geo-paths";

const NAV_ITEMS_BY_LINK = new Map(
  NAV_MAIN_ITEMS.map((item) => [item.link, item])
);

export function isSidebarMode(value: unknown): value is SidebarMode {
  return value === "geo" || value === "studio";
}

export function resolveSidebarMode(
  route: string | undefined,
  storedMode: SidebarMode | null
): SidebarMode {
  if (route === undefined) {
    return storedMode ?? "studio";
  }
  if (
    SHARED_ROUTE_PREFIXES.some(
      (prefix) => route === prefix || route.startsWith(`${prefix}/`)
    )
  ) {
    return storedMode ?? "studio";
  }
  const section = route.split("/", 1)[0] ?? route;
  if (GEO_ROUTE_SECTIONS.has(section)) {
    return "geo";
  }
  if (STUDIO_ROUTE_SECTIONS.has(section)) {
    return "studio";
  }
  return storedMode ?? SIDEBAR_DEFAULT_MODE;
}

/** Route after the org slug (`/{slug}/geo/prompts` → "geo/prompts"), or undefined on the org root. */
export function sidebarRouteFromPathname(pathname: string): string | undefined {
  return pathname.split("/").filter(Boolean).slice(1).join("/") || undefined;
}

export function isOrgRootPath(pathname: string, slug: string): boolean {
  return pathname === `/${slug}` || pathname === `/${slug}/`;
}

/** Path to send a bare dashboard open to, or null to stay on Studio home. */
export function resolveOrgRootRedirect(
  slug: string,
  storedMode: SidebarMode | null,
  projectId?: string,
  searchParams: SettingsUrlSearchParams = {}
): string | null {
  if (storedMode !== "geo") {
    return null;
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        query.append(key, item);
      }
    }
  }
  if (projectId) {
    query.set("project", projectId);
  }
  const path = geoNavHref(slug, GEO_OVERVIEW_NAV_LINK);
  return query.size ? `${path}?${query}` : path;
}

export function resolveNavGroupRow(
  group: NavGroup,
  first: NavMainItem,
  rest: readonly NavMainItem[],
  activeLink: string | null
): NavGroupRowState {
  const listsOwnPage = group.listsOwnPage || first.link !== group.links[0];
  const subRows = listsOwnPage
    ? [first, ...rest].toSorted(
        (a, b) => group.links.indexOf(a.link) - group.links.indexOf(b.link)
      )
    : [...rest];
  const groupActive =
    first.link === activeLink || rest.some((item) => item.link === activeLink);
  return {
    subRows,
    groupActive,
    ownPageActive: first.link === activeLink && !listsOwnPage,
    showSubRows: groupActive && subRows.length > 0,
    // A row with one page is that page, so it carries the page's badge.
    showOwnBadge: rest.length === 0 && !listsOwnPage,
  };
}

export function resolveNavItems(
  links: readonly string[],
  visibility: NavVisibility = DEFAULT_NAV_VISIBILITY
): NavMainItem[] {
  const items: NavMainItem[] = [];
  for (const link of links) {
    const item = NAV_ITEMS_BY_LINK.get(link);
    if (item) {
      items.push(item);
    }
  }
  const withAnalytics = visibility.analytics
    ? items
    : items.filter((item) => item.link !== ANALYTICS_NAV_LINK);
  const withSites = visibility.sites
    ? withAnalytics
    : withAnalytics.filter((item) => item.link !== SITES_NAV_LINK);
  return visibility.autopilot
    ? withSites
    : withSites.filter((item) => item.link !== AUTOPILOT_NAV_LINK);
}

export function resolveActiveNavLink(
  pathname: string,
  slug: string,
  links: readonly string[]
): string | null {
  const root = `/${slug}`;
  let active: string | null = null;
  for (const link of links) {
    const href = `${root}${link}`;
    if (link === "") {
      if (pathname === root || pathname === `${root}/`) {
        active = active ?? link;
      }
      continue;
    }
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (active === null || link.length > active.length)) {
      active = link;
    }
  }
  return active;
}
