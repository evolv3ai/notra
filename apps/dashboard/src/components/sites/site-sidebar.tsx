"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@notra/ui/components/ui/sidebar";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

import { SidebarLabel } from "@/components/dashboard/sidebar-label";
import Link from "@/components/framework/link";
import { useSite } from "@/components/sites/site-context";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import {
  SITE_DESIGN_GROUPS,
  SITE_DESIGN_SECTIONS,
} from "@/constants/site-design-sections";
import { SITE_NAV_SECTIONS, SITE_SECTIONS } from "@/constants/sites";
import { useSiteDesignSection } from "@/lib/hooks/use-site-design-section";
import { useSiteNavSection } from "@/lib/hooks/use-site-nav-section";
import { cn } from "@/lib/utils";
import type { SiteSection } from "@/types/sites";
import { configSectionChanged } from "@/utils/site-design-sections";
import { displayUrl, siteHref } from "@/utils/site-links";

const PAGE_SECTIONS = SITE_SECTIONS.filter(
  (item) => SITE_NAV_SECTIONS.has(item.section) && item.section !== "design"
);

function useSiteNavItems() {
  const { organizationSlug: slug, detail } = useSite();
  const { site } = detail;
  const { current, section, branch } = useSiteNavSection(slug, site.id);
  const { active } = useSiteDesignSection();
  const state = useSiteWorkspace();
  const href = (target: SiteSection, designSection?: string) => {
    const [path = "", query = ""] = siteHref(
      slug,
      site.id,
      target,
      site.projectId
    ).split("?");
    const params = new URLSearchParams(query);
    if (designSection) {
      params.set("section", designSection);
    }
    if (branch) {
      params.set("branch", branch);
    }
    const search = params.toString();
    return search ? `${path}?${search}` : path;
  };
  const changed = (paths: readonly string[]) =>
    Boolean(
      state &&
      !state.malformed &&
      configSectionChanged(state.config, state.published, paths)
    );
  return {
    site,
    pages: PAGE_SECTIONS.map((item) => ({
      ...item,
      href: href(item.section),
      current: current !== "design" && item.section === section,
    })),
    groups: SITE_DESIGN_GROUPS.map((group) => ({
      id: group.id,
      sections: SITE_DESIGN_SECTIONS.filter((config) =>
        (group.sections as readonly string[]).includes(config.id)
      ).map((config) => ({
        ...config,
        href: href("design", config.id),
        current: current === "design" && active.id === config.id,
        changed: changed(config.paths),
      })),
    })),
  };
}

function ChangedDot() {
  const t = useTranslations("sites.design.workspace");
  return (
    <span
      aria-label={t("unpublished")}
      className="bg-primary ms-auto size-1.5 shrink-0 rounded-full"
      role="img"
    />
  );
}

/** Site pages and Design sections beside every site page, Mintlify style. */
export function SiteSidebar() {
  const tabs = useTranslations("sites.detail.tabs");
  const sections = useTranslations("sites.design.sections");
  const { site, pages, groups } = useSiteNavItems();
  return (
    <aside
      aria-label={tabs("label")}
      className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 border-e md:block"
    >
      <div className="flex h-full min-h-0 flex-col">
        <nav
          aria-label={tabs("label")}
          className="min-h-0 flex-1 overflow-y-auto py-1"
        >
          <SidebarGroup>
            <SidebarMenu>
              {pages.map((item) => (
                <SidebarMenuItem key={item.section}>
                  <SidebarMenuButton
                    isActive={item.current}
                    render={
                      <Link
                        aria-current={item.current ? "page" : undefined}
                        exact
                        href={item.href}
                      />
                    }
                  >
                    <HugeiconsIcon icon={item.icon} />
                    <SidebarLabel>{tabs(item.section)}</SidebarLabel>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          {groups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>
                {sections(`groups.${group.id}`)}
              </SidebarGroupLabel>
              <SidebarMenu>
                {group.sections.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={item.current}
                      render={
                        <Link
                          aria-current={item.current ? "page" : undefined}
                          exact
                          href={item.href}
                        />
                      }
                    >
                      <HugeiconsIcon icon={item.icon} />
                      <SidebarLabel>
                        {sections(`titles.${item.id}`)}
                      </SidebarLabel>
                      {item.changed ? <ChangedDot /> : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </nav>
        <div className="shrink-0 border-t p-2">
          <a
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring flex h-8 items-center gap-2 rounded-md px-2 text-sm outline-hidden focus-visible:ring-2"
            href={site.liveUrl}
            rel="noreferrer"
            target="_blank"
          >
            <span className="min-w-0 flex-1 truncate">
              {displayUrl(site.liveUrl)}
            </span>
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3.5 shrink-0"
              icon={ArrowUpRight01Icon}
            />
          </a>
        </div>
      </div>
    </aside>
  );
}

/** Below md the sidebar becomes one scrolling row under the site bar. */
export function SiteMobileNav() {
  const tabs = useTranslations("sites.detail.tabs");
  const sections = useTranslations("sites.design.sections");
  const { pages, groups } = useSiteNavItems();
  const items = [
    ...pages.map((item) => ({
      key: item.section,
      href: item.href,
      current: item.current,
      icon: item.icon,
      label: tabs(item.section),
      changed: false,
    })),
    ...groups.flatMap((group) =>
      group.sections.map((item) => ({
        key: item.id,
        href: item.href,
        current: item.current,
        icon: item.icon,
        label: sections(`titles.${item.id}`),
        changed: item.changed,
      }))
    ),
  ];
  const navRef = useRef<HTMLElement>(null);
  const currentKey = items.find((item) => item.current)?.key;
  // Keep the current page in view when the row scrolls.
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!(nav && item)) {
      return;
    }
    const right = item.offsetLeft + item.offsetWidth - nav.clientWidth;
    if (nav.scrollLeft < right || nav.scrollLeft > item.offsetLeft) {
      nav.scrollLeft = Math.max(0, right);
    }
  }, [currentKey]);
  return (
    <nav
      aria-label={tabs("label")}
      className="bg-sidebar relative flex shrink-0 scrollbar-none gap-1 overflow-x-auto border-b p-2 md:hidden"
      ref={navRef}
    >
      {items.map((item) => (
        <Link
          aria-current={item.current ? "page" : undefined}
          exact
          className={cn(
            "focus-visible:ring-ring/50 flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm outline-none focus-visible:ring-3",
            item.current
              ? "bg-sidebar-accent text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
          href={item.href}
          key={item.key}
        >
          <HugeiconsIcon className="size-4 shrink-0" icon={item.icon} />
          {item.label}
          {item.changed ? <ChangedDot /> : null}
        </Link>
      ))}
    </nav>
  );
}
