"use client";

import {
  PlusSignIcon,
  Settings01Icon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@notra/ui/components/ui/sidebar";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Notra } from "@notra/ui/components/ui/svgs/notra";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { GeoProjectCreateDialog } from "@/components/geo/project-create-dialog";
import { ProjectLogo } from "@/components/geo/project-logo";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { GEO_SETTINGS_NAV_LINK } from "@/constants/nav";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useBrandSettings } from "@/lib/hooks/use-brand-analysis";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { useLoadedSiteProjectId } from "@/lib/hooks/use-sites";
import { usePathname, useRouter } from "@/lib/navigation";
import type {
  ProjectMenuListProps,
  ProjectSwitcherTriggerProps,
} from "@/types/components/sidebar-project-switcher";
import { getWebsiteDomain } from "@/utils/brand";
import { setLastVisitedProject } from "@/utils/cookies";
import { isGeoDashboardPath } from "@/utils/geo-paths";
import { resolveNavItems } from "@/utils/nav";
import { siteIdFromPath } from "@/utils/site-links";

import { SidebarLabel } from "./sidebar-label";
import {
  OrgActionItems,
  OrgMenuDialogs,
  OrgSwitcherSubmenu,
  useOrgMenu,
} from "./sidebar-org-menu";

const GEO_SETTINGS_ITEM = resolveNavItems([GEO_SETTINGS_NAV_LINK]).at(0);

export function ProjectSwitcherTrigger({
  project,
  domain,
  isLoading,
  logo,
  logoDomain,
  logoName,
  ...props
}: ProjectSwitcherTriggerProps) {
  const t = useTranslations("nav.orgSelector");
  if (isLoading) {
    return (
      <SidebarMenuButton
        aria-busy
        aria-label={t("loadingProjects")}
        className="data-popup-open:bg-sidebar-accent cursor-pointer [--sidebar-lg-icon:1.75rem]"
        size="lg"
        tooltip={t("loadingProjects")}
        {...props}
      >
        <Skeleton className="size-7 shrink-0 rounded-lg" />
        <Skeleton className="h-4 max-w-24 flex-1 group-data-[collapsible=icon]:hidden" />
      </SidebarMenuButton>
    );
  }

  if (!project) {
    return (
      <SidebarMenuButton
        className="data-popup-open:bg-sidebar-accent cursor-pointer"
        size="lg"
        tooltip="Notra"
        {...props}
      >
        <span className="bg-background flex size-7 shrink-0 items-center justify-center rounded-lg dark:bg-[#F6F3F1]">
          <Notra className="size-7 dark:size-5" />
        </span>
        <SidebarLabel className="flex-1 text-base font-semibold">
          Notra
        </SidebarLabel>
        <HugeiconsIcon
          className="text-muted-foreground ml-auto"
          icon={UnfoldMoreIcon}
        />
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuButton
      className="data-popup-open:bg-sidebar-accent cursor-pointer [--sidebar-lg-icon:1.75rem]"
      size="lg"
      tooltip={project.name}
      {...props}
    >
      <ProjectLogo
        className="size-7 rounded-lg"
        domain={logoDomain === undefined ? domain : logoDomain}
        fallbackClassName="bg-sidebar-accent rounded-lg"
        logo={logo}
        name={logoName ?? project.name}
      />
      <div className="grid min-w-0 flex-1 leading-tight">
        <SidebarLabel className="truncate text-sm font-medium">
          {project.name}
        </SidebarLabel>
        {domain ? (
          <SidebarLabel className="text-muted-foreground truncate text-xs">
            {domain}
          </SidebarLabel>
        ) : null}
      </div>
      <HugeiconsIcon
        className="text-muted-foreground ml-auto"
        icon={UnfoldMoreIcon}
      />
    </SidebarMenuButton>
  );
}

function ProjectMenuList({
  projects,
  activeProjectId,
  projectDomain,
  onSwitch,
}: ProjectMenuListProps) {
  const tCommon = useTranslations("common");
  if (projects.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{tCommon("labels.projects")}</DropdownMenuLabel>
        {projects.map((project) => {
          const isSelected = activeProjectId === project.id;
          return (
            <DropdownMenuItem
              className="cursor-pointer gap-2 py-1.5 pl-7"
              key={project.id}
              onClick={() => {
                if (!isSelected) {
                  trackEvent(POSTHOG_EVENTS.GEO_PROJECT_SWITCHED, {
                    project_id: project.id,
                    project_count: projects.length,
                  });
                  onSwitch(project.id);
                }
              }}
            >
              {isSelected ? (
                <HugeiconsIcon
                  className="text-muted-foreground absolute left-2 size-3.5"
                  icon={Tick02Icon}
                />
              ) : null}
              <ProjectLogo
                domain={projectDomain(project.brandSettingsId)}
                name={project.name}
              />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}

export function SidebarProjectSwitcher() {
  const tCommon = useTranslations("common");
  const tOrg = useTranslations("nav.orgSelector");
  const pathname = usePathname();
  const router = useRouter();
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const slug = activeOrganization?.slug ?? "";
  const [projectParam, setProjectParam] = useGeoProjectQueryState();
  const siteId = siteIdFromPath(pathname);
  const siteProjectId = useLoadedSiteProjectId(organizationId, siteId);
  const activeScope = useActiveProject();
  const switchProject = (projectId: string) => {
    if (siteId) {
      router.push(`/${slug}/sites?project=${encodeURIComponent(projectId)}`);
    } else {
      setProjectParam(projectId);
    }
  };
  const { openSettings } = useSettingsModal();
  const [createOpen, setCreateOpen] = useState(false);
  const orgMenu = useOrgMenu();

  const {
    projects: loadedProjects,
    isLoading,
    isError,
    isReady,
  } = useGeoProjectsDb(organizationId);
  const { data: brandData } = useBrandSettings(organizationId);
  const projects = loadedProjects;
  const voices = brandData?.voices ?? [];
  const selectedProjectId = siteId
    ? (siteProjectId ?? undefined)
    : activeScope.projectId;
  const activeProject = projects.find(
    (project) => project.id === selectedProjectId
  );

  useEffect(() => {
    if (isLoading || isError || !isReady || !slug) {
      return;
    }

    if (activeProject?.id === projectParam) {
      setLastVisitedProject(slug, activeProject.id).catch(() => {});
      return;
    }

    if (!isGeoDashboardPath(pathname)) {
      return;
    }

    const restoredProjectId = activeProject?.id ?? null;

    if (projectParam !== restoredProjectId) {
      setProjectParam(restoredProjectId);
    }
  }, [
    activeProject,
    isError,
    isLoading,
    isReady,
    pathname,
    projectParam,
    setProjectParam,
    slug,
  ]);

  const projectDomain = (brandSettingsId: string) =>
    getWebsiteDomain(
      voices.find((voice) => voice.id === brandSettingsId)?.websiteUrl ?? null
    );

  // Only the project half waits for these; the org menu stays usable.
  const isProjectLoading = Boolean(
    organizationId &&
    !activeScope.isError &&
    (!activeScope.isResolved || (siteId && siteProjectId === undefined))
  );

  const activeDomain = activeProject
    ? projectDomain(activeProject.brandSettingsId)
    : null;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <ProjectSwitcherTrigger
                  domain={activeDomain}
                  isLoading={isProjectLoading}
                  project={activeProject}
                />
              }
            />
            <DropdownMenuContent align="start" className="w-64" sideOffset={4}>
              <OrgSwitcherSubmenu onCreate={orgMenu.openCreate} />
              <ProjectMenuList
                activeProjectId={activeProject?.id}
                onSwitch={switchProject}
                projectDomain={projectDomain}
                projects={isProjectLoading ? [] : projects}
              />
              <DropdownMenuItem
                className="cursor-pointer gap-2 py-1.5"
                onClick={() => setCreateOpen(true)}
              >
                <HugeiconsIcon icon={PlusSignIcon} />
                {tCommon("labels.newProject")}
              </DropdownMenuItem>
              {activeProject && !isProjectLoading ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 py-1.5"
                  onClick={() => openSettings("geo-brand")}
                >
                  <HugeiconsIcon
                    icon={GEO_SETTINGS_ITEM?.icon ?? Settings01Icon}
                  />
                  {tOrg("projectSettings")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <OrgActionItems onOpenTopup={orgMenu.openTopup} />
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <OrgMenuDialogs menu={orgMenu} />
      <GeoProjectCreateDialog
        onCreated={switchProject}
        onOpenChange={setCreateOpen}
        open={createOpen}
        organizationId={organizationId}
      />
    </>
  );
}
