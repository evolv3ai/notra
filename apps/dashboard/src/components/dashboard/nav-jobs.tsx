"use client";

import { SidebarGroup } from "@notra/ui/components/ui/sidebar";
import { useRouterState } from "@tanstack/react-router";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { NAV_GROUPS, NAV_WORKSPACE_GROUP } from "@/constants/nav";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";
import { useSidebarMode } from "@/lib/hooks/use-sidebar-mode";
import { usePathname } from "@/lib/navigation";
import { resolveActiveNavLink, sidebarRouteFromPathname } from "@/utils/nav";

import { NavGroupList } from "./nav-group-list";

const NAV_LINKS: readonly string[] = [
  ...NAV_GROUPS,
  NAV_WORKSPACE_GROUP,
].flatMap((group) => group.links);

/**
 * Follows the navigation target while a route is still loading, so a clicked
 * row lights up on press instead of after the next page has rendered.
 */
export function useActiveNavLink(slug: string) {
  const pathname = usePathname();
  const pendingPathname = useRouterState({
    select: (state) =>
      state.status === "pending" ? state.location.pathname : null,
  });
  const pendingLink = pendingPathname
    ? resolveActiveNavLink(pendingPathname, slug, NAV_LINKS)
    : null;
  return pendingLink ?? resolveActiveNavLink(pathname, slug, NAV_LINKS);
}

export function NavJobs() {
  const { activeOrganization } = useOrganizationsContext();
  const pathname = usePathname();
  const [projectParam] = useGeoProjectQueryState();
  const visibility = useNavVisibility();
  const slug = activeOrganization?.slug;
  const activeLink = useActiveNavLink(slug ?? "");
  // Persists the route's mode so the bare org URL still restores GEO or Studio.
  useSidebarMode(sidebarRouteFromPathname(pathname));

  if (!slug) {
    return null;
  }

  return (
    <SidebarGroup>
      <NavGroupList
        activeLink={activeLink}
        groups={NAV_GROUPS}
        projectId={projectParam ?? undefined}
        slug={slug}
        visibility={visibility}
      />
    </SidebarGroup>
  );
}
