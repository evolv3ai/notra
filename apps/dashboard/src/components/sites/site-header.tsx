"use client";

import {
  PlusSignIcon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import { ProjectLogo } from "@/components/geo/project-logo";
import { SiteHeaderActions } from "@/components/sites/site-header-actions";
import { SITES_NAV_LINK } from "@/constants/sites";
import { useSiteNavSection } from "@/lib/hooks/use-site-nav-section";
import { useSitesList } from "@/lib/hooks/use-sites";
import { useRouter } from "@/lib/navigation";
import type {
  SiteHeaderProps,
  SiteSwitcherProps,
} from "@/types/components/sites";
import { displayUrl, hostFromOrigin, siteHref } from "@/utils/site-links";

function SiteSwitcher({
  slug,
  organizationId,
  site,
  section,
}: SiteSwitcherProps) {
  const t = useTranslations("sites.switcher");
  const router = useRouter();
  const { data } = useSitesList(organizationId, site.projectId);
  const sites = data?.sites ?? [site];
  const identity = (
    <>
      <ProjectLogo
        domain={hostFromOrigin(site.publicOrigin)}
        name={site.name}
      />
      <span className="truncate">{site.name}</span>
    </>
  );
  // Nothing to switch to: a plain label instead of a one-item menu.
  if (sites.length < 2) {
    return (
      <div className="flex h-8 max-w-64 min-w-0 items-center gap-2 text-sm font-medium">
        {identity}
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label={t("label", { name: site.name })}
            className="hover:bg-sidebar-accent focus-visible:ring-ring/50 data-popup-open:bg-sidebar-accent -ml-2 flex h-8 max-w-64 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium outline-none focus-visible:ring-3"
            type="button"
          >
            {identity}
            <HugeiconsIcon
              className="text-muted-foreground size-3.5 shrink-0"
              icon={UnfoldMoreIcon}
            />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-60" sideOffset={4}>
        <DropdownMenuGroup>
          {sites.map((item) => (
            <DropdownMenuItem
              className="cursor-pointer"
              key={item.id}
              onClick={() => {
                if (item.id !== site.id) {
                  router.push(siteHref(slug, item.id, section, item.projectId));
                }
              }}
            >
              <ProjectLogo
                domain={hostFromOrigin(item.publicOrigin)}
                name={item.name}
              />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate">{item.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {displayUrl(item.liveUrl)}
                </span>
              </span>
              {item.id === site.id ? (
                <HugeiconsIcon
                  className="text-muted-foreground size-4"
                  icon={Tick02Icon}
                />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push(`/${slug}${SITES_NAV_LINK}/new`)}
        >
          <HugeiconsIcon icon={PlusSignIcon} />
          {t("newSite")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The site's own bar above every site page: which site, which branch, Publish. */
export function SiteHeader({ slug, organizationId, site }: SiteHeaderProps) {
  const { section } = useSiteNavSection(slug, site.id);
  return (
    <div className="bg-sidebar text-sidebar-foreground sticky top-0 z-20 flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 border-b px-4 lg:px-5">
      <SiteSwitcher
        organizationId={organizationId}
        section={section}
        site={site}
        slug={slug}
      />
      <SiteHeaderActions />
    </div>
  );
}
