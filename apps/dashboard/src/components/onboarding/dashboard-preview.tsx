"use client";

import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@notra/ui/components/ui/sidebar";
import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";

import { SidebarLabel } from "@/components/dashboard/sidebar-label";
import { ProjectSwitcherTrigger } from "@/components/dashboard/sidebar-project-switcher";
import {
  OnboardingPreviewCompetitorsPage,
  OnboardingPreviewOverviewPage,
  OnboardingPreviewPromptsPage,
} from "@/components/onboarding/dashboard-preview-pages";
import {
  OnboardingPreviewTargetContext,
  OnboardingSplitLayoutContext,
} from "@/components/onboarding/split-layout-context";
import {
  ONBOARDING_PREVIEW_NAV_GROUPS,
  ONBOARDING_PREVIEW_PAGE_PATHS,
  ONBOARDING_PREVIEW_ZOOM,
} from "@/constants/onboarding";
import { useOnboardingPreviewLens } from "@/lib/hooks/use-onboarding-preview-lens";
import { cn } from "@/lib/utils";
import type {
  OnboardingDashboardPreviewProps,
  OnboardingPreviewAddressBarProps,
  OnboardingPreviewMainProps,
  OnboardingPreviewNavProps,
} from "@/types/onboarding";
import {
  onboardingPreviewHost,
  onboardingPreviewLogoName,
} from "@/utils/onboarding";

function OnboardingPreviewAddressBar({
  slug,
  page,
}: OnboardingPreviewAddressBarProps) {
  return (
    <div className="bg-muted/40 relative flex h-10 shrink-0 items-center border-b px-4">
      <div className="flex gap-2">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
      </div>
      <div className="bg-background text-muted-foreground absolute left-1/2 flex h-6 max-w-[55%] -translate-x-1/2 items-center gap-1.5 truncate rounded-md border px-3 text-xs">
        <HugeiconsIcon className="shrink-0" icon={SquareLock02Icon} size={12} />
        <span className="truncate">
          app.usenotra.com/
          <span className="text-foreground font-medium">{slug}</span>
          {ONBOARDING_PREVIEW_PAGE_PATHS[page]}
        </span>
      </div>
    </div>
  );
}

function OnboardingPreviewNav({ page }: OnboardingPreviewNavProps) {
  const tLabels = useTranslations("common.labels");
  return (
    <SidebarMenu>
      {ONBOARDING_PREVIEW_NAV_GROUPS.map((group) => (
        <SidebarMenuItem key={group.id}>
          <SidebarMenuButton
            className="cursor-pointer"
            isActive={group.id === page}
            tabIndex={-1}
          >
            <HugeiconsIcon icon={group.icon} />
            {group.id === page ? (
              <SidebarLabel>{tLabels(group.labelKey)}</SidebarLabel>
            ) : (
              <span
                className="bg-muted-foreground/15 h-2 rounded-full"
                style={{
                  width: `${tLabels(group.labelKey).length * 0.4}rem`,
                }}
              />
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function OnboardingPreviewMain({
  page,
  companyName,
  prompts,
  competitors,
}: OnboardingPreviewMainProps) {
  const tLabels = useTranslations("common.labels");
  return (
    <main className="@container/main flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b px-4 text-sm font-medium lg:px-6">
        {page === "overview" ? "GEO" : tLabels(page)}
      </header>
      {page === "overview" ? (
        <OnboardingPreviewOverviewPage companyName={companyName} />
      ) : null}
      {page === "prompts" ? (
        <OnboardingPreviewPromptsPage prompts={prompts} />
      ) : null}
      {page === "competitors" ? (
        <OnboardingPreviewCompetitorsPage competitors={competitors} />
      ) : null}
    </main>
  );
}

export function OnboardingDashboardPreview({
  focus,
  name,
  slug,
  logoUrl,
  logoDomain,
  logoName,
  website,
  prompts = [],
  competitors = [],
  defaultPage = "overview",
}: OnboardingDashboardPreviewProps) {
  const target = useContext(OnboardingPreviewTargetContext);
  const layout = useContext(OnboardingSplitLayoutContext);
  const t = useTranslations("onboarding.preview");
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [lensContent, setLensContent] = useState<HTMLDivElement | null>(null);
  const zoom = focus ? ONBOARDING_PREVIEW_ZOOM[focus] : null;
  const page = zoom?.page ?? defaultPage;
  const lens = useOnboardingPreviewLens({
    viewport,
    lensContent,
    focus,
    scale: zoom?.scale,
    page,
  });

  if (!target) {
    return null;
  }

  const displayName = name?.trim() || t("placeholderName");

  return createPortal(
    <div
      aria-hidden="true"
      className="[container-type:size] absolute inset-0 overflow-hidden [&_*]:animate-none [&_[data-slot=skeleton]]:before:animate-none"
      inert
      ref={setViewport}
    >
      <div className="flex min-h-full w-full min-w-5xl flex-col pt-10 pl-10">
        <div className="bg-background text-foreground relative flex flex-1 flex-col overflow-hidden rounded-tl-xl border-t border-l">
          <OnboardingPreviewAddressBar
            page={page}
            slug={slug || layout?.organizationSlug || t("placeholderSlug")}
          />

          <SidebarProvider className="min-h-0! flex-1" keyboardShortcut={false}>
            <div className="w-(--sidebar-width) shrink-0 overflow-hidden">
              <Sidebar className="h-full border-r" collapsible="none">
                <SidebarHeader>
                  <SidebarMenu>
                    <SidebarMenuItem data-zoom="name website">
                      <ProjectSwitcherTrigger
                        domain={onboardingPreviewHost(website) || null}
                        isLoading={false}
                        logo={logoUrl}
                        logoDomain={logoDomain}
                        logoName={onboardingPreviewLogoName(
                          logoName,
                          t("placeholderName")
                        )}
                        project={{ name: displayName }}
                      />
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <OnboardingPreviewNav page={page} />
                  </SidebarGroup>
                </SidebarContent>
              </Sidebar>
            </div>

            <OnboardingPreviewMain
              competitors={competitors}
              companyName={displayName}
              page={page}
              prompts={prompts}
            />
          </SidebarProvider>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[min(100%,calc(100cqw-2.5rem))] bg-[linear-gradient(to_right,transparent_78%,var(--color-muted)),linear-gradient(to_bottom,transparent_72%,var(--color-muted))]" />
        </div>
      </div>
      <div
        className={cn(
          "bg-background text-foreground ring-primary/25 ease-emphasized-in-out duration-slower pointer-events-none absolute top-0 left-0 box-content origin-top-left overflow-hidden rounded-xl border p-2 ring-4 motion-reduce:transition-none [&>li]:list-none",
          lens.glide ? "transition-[opacity,transform]" : "transition-opacity",
          lens.visible ? "opacity-100" : "opacity-0"
        )}
        ref={setLensContent}
        style={{
          transform: lens.transform,
          width: lens.width,
          height: lens.height,
        }}
      />
    </div>,
    target
  );
}
