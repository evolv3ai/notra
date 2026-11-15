"use client";

import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  Building03Icon,
  Folder01Icon,
  Message01Icon,
  Moon02Icon,
  PencilEdit01Icon,
  SearchIcon,
  SparklesIcon,
  Sun03Icon,
  Tick02Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GEO_WRITER_NAV_LINK } from "@notra/geo-core/constants/geo";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@notra/ui/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { useIsApplePlatform } from "@notra/ui/hooks/use-is-apple-platform";
import { cn } from "@notra/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useFeedback } from "@/components/dashboard/feedback-context";
import { ProjectLogo } from "@/components/geo/project-logo";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  COMMAND_PALETTE_PUMPKIN_EASTER_EGG,
  COMMAND_PALETTE_ENTITY_ICONS,
  COMMAND_PALETTE_SEARCH_MIN_LENGTH,
  COMMAND_PALETTE_SUGGESTED_ROUTES,
  COMMAND_PALETTE_THEME_SHORTCUT,
  COMMAND_ROUTE_LABEL_KEYS,
  COMMAND_SECTION_LABEL_KEYS,
  COMMAND_ROUTES,
  COMMAND_SECTIONS,
} from "@/constants/command-palette";
import { COMMAND_PALETTE_AI_ERROR_ACTION } from "@/constants/studio-analytics";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useBrandSettings } from "@/lib/hooks/use-brand-analysis";
import { useCommandPaletteAi } from "@/lib/hooks/use-command-palette-ai";
import { useCommandPaletteEntitySearch } from "@/lib/hooks/use-command-palette-entity-search";
import { useCommandPaletteRecents } from "@/lib/hooks/use-command-palette-recents";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";
import { useHasAiCreditsFeature, useHasGeoFeature } from "@/lib/hooks/use-plan";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { useSwitchOrganization } from "@/lib/hooks/use-switch-organization";
import { usePathname, useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AiResult,
  CommandPaletteAiState,
  CommandPaletteController,
  CommandPalettePage,
  CommandPaletteRecent,
  CommandPaletteSearchData,
  CommandPaletteTranslator,
  CommandRoute,
  CommandSection,
  EntityHit,
  EntityHitSection,
  EntityHitsBySection,
} from "@/types/components/command-palette";
import type { CommonTranslator } from "@/types/i18n";
import { resolveOrganizationLogo } from "@/utils/avatar";
import { getWebsiteDomain } from "@/utils/brand";
import {
  commandPaletteEntityPath,
  commandPaletteFilter,
  isCommandRouteAvailable,
  isCommandRouteVisible,
} from "@/utils/command-palette";
import { truncateSnippet } from "@/utils/format";
import { isGeoDashboardPath, withGeoProject } from "@/utils/geo-paths";
import { nameInitials } from "@/utils/name-initials";

import { useCommandPalette } from "./command-palette-context";
import {
  CommandPaletteGroup,
  CommandPaletteItem,
} from "./command-palette-item";
import { PumpkinRain } from "./pumpkin-rain";

const GEO_PROJECT_PARAM_PATTERN = /[?&]project=/;

const BRAILLE_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;
const BRAILLE_INTERVAL_MS = 80;
const ENTITY_SECTION_ORDER: readonly EntityHitSection[] = [
  "prompts",
  "competitors",
  "personas",
  "posts",
  "chats",
  "sites",
  "brandVoices",
  "references",
  "integrations",
];

const GROUPED_ROUTES = (() => {
  const groups: Record<CommandSection, CommandRoute[]> = {
    Navigation: [],
    GEO: [],
    Workspace: [],
    Automation: [],
    Manage: [],
    Settings: [],
  };
  for (const route of COMMAND_ROUTES) {
    groups[route.section].push(route);
  }
  return groups;
})();

const ROUTES_BY_ID = new Map(COMMAND_ROUTES.map((route) => [route.id, route]));

function BrailleSpinner({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((prev) => (prev + 1) % BRAILLE_FRAMES.length);
    }, BRAILLE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block font-mono tabular-nums", className)}
    >
      {BRAILLE_FRAMES[frame]}
    </span>
  );
}

export function CommandPalette() {
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const { open, setOpen, openSourceRef } = useCommandPalette();
  const { activeOrganization, requestOrganizations } =
    useOrganizationsContext();
  const { hasAiCredits } = useHasAiCreditsFeature();
  const { openSettings } = useSettingsModal();
  const router = useRouter();
  const pathname = usePathname();
  const isApplePlatform = useIsApplePlatform();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<CommandPalettePage | null>(null);
  const [, startNavigation] = useTransition();
  const { openFeedback: triggerFeedback } = useFeedback();
  const wasOpenRef = useRef(false);

  const slug = activeOrganization?.slug ?? "";
  const organizationId = activeOrganization?.id ?? "";
  const { recents, addRecent } = useCommandPaletteRecents(organizationId);

  const [projectParam] = useGeoProjectQueryState();
  const { projectId: activeProjectId, isResolved: isProjectResolved } =
    useActiveProject();

  const close = () => setOpen(false);

  const scopedPath = (path: string) =>
    isGeoDashboardPath(path) && !GEO_PROJECT_PARAM_PATTERN.test(path)
      ? withGeoProject(path, projectParam ?? undefined)
      : path;

  const navigate = (path: string) => {
    close();
    router.push(scopedPath(path));
  };

  const { aiState, runAiSearch, resetAi } = useCommandPaletteAi({
    query,
    slug,
    projectId: activeProjectId,
    close,
    openSettings,
    pushPath: (path) => {
      startNavigation(() => {
        router.push(scopedPath(path));
      });
    },
  });

  const { entityHitsBySection, isSearchPending, isSearchError, retrySearch } =
    useCommandPaletteEntitySearch({
      open,
      enabled: page === null && aiState.status === "idle",
      organizationId,
      projectId: activeProjectId,
      isProjectResolved,
      slug,
      query,
    });

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      requestOrganizations();
      trackEvent(POSTHOG_EVENTS.COMMAND_PALETTE_OPENED, {
        source: openSourceRef.current ?? "button",
      });
    }
    if (!open && wasOpenRef.current) {
      resetAi();
      setQuery("");
      setPage(null);
      openSourceRef.current = null;
    }
    wasOpenRef.current = open;
  }, [open, openSourceRef, requestOrganizations, resetAi]);

  const selectRoute = (route: CommandRoute) => {
    trackEvent(POSTHOG_EVENTS.COMMAND_PALETTE_RESULT_SELECTED, {
      kind: "route",
      id: route.id,
    });
    addRecent({ kind: "route", id: route.id });
    if (route.settingsSection) {
      close();
      openSettings(route.settingsSection);
      return;
    }
    navigate(route.path(slug));
  };

  const selectEntity = (hit: EntityHit) => {
    trackEvent(POSTHOG_EVENTS.COMMAND_PALETTE_RESULT_SELECTED, {
      kind: "entity",
      entity_type: hit.kind,
    });
    const path =
      isGeoDashboardPath(hit.path) && !GEO_PROJECT_PARAM_PATTERN.test(hit.path)
        ? withGeoProject(hit.path, activeProjectId ?? undefined)
        : hit.path;
    addRecent({
      kind: "entity",
      key: hit.key,
      entityKind: hit.kind,
      label: hit.label,
      sublabel: hit.sublabel,
      path,
    });
    navigate(path);
  };

  const selectRecent = (recent: CommandPaletteRecent) => {
    if (recent.kind === "route") {
      const route = ROUTES_BY_ID.get(recent.id);
      if (route) {
        selectRoute(route);
      }
      return;
    }
    selectEntity({
      ...recent,
      kind: recent.entityKind,
      icon: COMMAND_PALETTE_ENTITY_ICONS[recent.entityKind],
      keywords: [],
    });
  };

  const trackAction = (id: string) => {
    trackEvent(POSTHOG_EVENTS.COMMAND_PALETTE_RESULT_SELECTED, {
      kind: "action",
      id,
    });
  };

  const openFeedback = () => {
    trackAction("feedback");
    close();
    triggerFeedback();
  };

  const openPage = (next: CommandPalettePage) => {
    trackAction(next);
    setQuery("");
    setPage(next);
  };

  const closePage = () => {
    setQuery("");
    setPage(null);
  };

  const isPumpkin = (value: string) =>
    value.trim().toLowerCase() === COMMAND_PALETTE_PUMPKIN_EASTER_EGG.query;

  const changeQuery = (value: string) => {
    if (isPumpkin(value) && !isPumpkin(query)) {
      const audio = new Audio(COMMAND_PALETTE_PUMPKIN_EASTER_EGG.sound);
      audio.volume = COMMAND_PALETTE_PUMPKIN_EASTER_EGG.volume;
      audio.play().catch(() => undefined);
    }
    setQuery(value);
    if (aiState.status !== "idle") {
      resetAi();
    }
  };

  if (!slug) {
    return null;
  }

  const controller: CommandPaletteController = {
    slug,
    organizationId,
    mode: isGeoDashboardPath(pathname) ? "geo" : "studio",
    pathname,
    query,
    trimmedQuery: query.trim(),
    page,
    aiState,
    aiModifierLabel: isApplePlatform ? "⌘" : "Ctrl",
    hasAiCredits,
    entityHitsBySection,
    isSearchPending,
    isSearchError,
    retrySearch,
    recents,
    close,
    navigate,
    selectRoute,
    selectEntity,
    selectRecent,
    trackAction,
    openFeedback,
    openPage,
    closePage,
    runAiSearch,
    changeQuery,
  };

  return (
    <Dialog
      onOpenChange={(next, eventDetails) => {
        if (!next && page && eventDetails.reason === "escape-key") {
          eventDetails.cancel();
          closePage();
          return;
        }
        setOpen(next);
      }}
      open={open}
    >
      <DialogContent
        className="border-shell-border bg-shell top-[18%] w-[calc(100%-2rem)] max-w-[45rem]! translate-y-0 gap-0 overflow-hidden rounded-2xl! border p-0! shadow-2xl ring-0 sm:max-w-[45rem]!"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{tCommon("labels.commandPalette")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <CommandPaletteBody controller={controller} />
        {isPumpkin(query) ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-15"
              style={{
                backgroundImage: `url(${COMMAND_PALETTE_PUMPKIN_EASTER_EGG.image})`,
              }}
            />
            <PumpkinRain />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CommandPaletteBody({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const { aiState, page, query, trimmedQuery } = controller;
  const hasQuery = trimmedQuery.length > 0;
  const isLoading =
    aiState.status === "loading" || aiState.status === "navigating";
  const canUseAi = page === null && hasQuery;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [page]);

  return (
    <CommandPrimitive
      className="text-popover-foreground flex size-full min-w-0 flex-col bg-transparent"
      key={page ?? "home"}
      onKeyDown={(event) => {
        if (event.key === "Backspace" && page && query.length === 0) {
          event.preventDefault();
          controller.closePage();
          return;
        }
        if (
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey) &&
          canUseAi
        ) {
          event.preventDefault();
          controller.runAiSearch().catch(() => undefined);
        }
      }}
      filter={commandPaletteFilter}
      shouldFilter={aiState.status === "idle"}
    >
      <div className="border-table-card-border bg-table-card shadow-table-card m-0.5 mb-0 overflow-hidden rounded-[14px] border">
        <div className="border-border/60 flex h-12 items-center gap-2.5 border-b px-4">
          <HugeiconsIcon
            className="text-muted-foreground size-4 shrink-0"
            icon={SearchIcon}
            strokeWidth={2}
          />
          {page ? (
            <button
              className="bg-muted text-foreground hover:bg-muted/70 flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md pr-2 pl-1 text-xs font-medium transition-colors"
              onClick={controller.closePage}
              type="button"
            >
              <HugeiconsIcon
                className="text-muted-foreground size-3.5"
                icon={ArrowLeft01Icon}
                strokeWidth={2}
              />
              {t(`pages.${page}.title`)}
            </button>
          ) : null}
          <CommandPrimitive.Input
            className={cn(
              "text-foreground flex-1 bg-transparent text-sm outline-none",
              "placeholder:text-muted-foreground/70",
              isLoading && "text-muted-foreground"
            )}
            onValueChange={controller.changeQuery}
            ref={inputRef}
            placeholder={
              page ? t(`pages.${page}.placeholder`) : t("placeholder")
            }
            value={query}
          />
          {canUseAi ? (
            <div className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex">
              <Kbd>{controller.aiModifierLabel}</Kbd>
              <Kbd>↵</Kbd>
              <span>{t("forAi")}</span>
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden">
          {isLoading ? <CommandPaletteLoading controller={controller} /> : null}
          <CommandPrimitive.List
            className={cn(
              "[&_[cmdk-group]:not([hidden])~[cmdk-group]:not([hidden])]:border-border/60 max-h-[24rem] scroll-py-2 overflow-y-auto overscroll-contain p-1.5 [&_[cmdk-group]:not([hidden])~[cmdk-group]:not([hidden])]:mt-1 [&_[cmdk-group]:not([hidden])~[cmdk-group]:not([hidden])]:border-t [&_[cmdk-group]:not([hidden])~[cmdk-group]:not([hidden])]:pt-1",
              isLoading && "hidden"
            )}
          >
            {page === "projects" ? (
              <CommandPaletteProjectsPage controller={controller} />
            ) : null}
            {page === "workspaces" ? (
              <CommandPaletteWorkspacesPage controller={controller} />
            ) : null}
            {page === null ? (
              <CommandPaletteHome controller={controller} />
            ) : null}
          </CommandPrimitive.List>
        </div>
      </div>

      <div className="text-muted-foreground [&_[data-slot=kbd]]:bg-popover [&_[data-slot=kbd]]:border-border flex h-10 shrink-0 items-center justify-between gap-3 px-3.5 text-xs [&_[data-slot=kbd]]:border [&_[data-slot=kbd]]:shadow-xs">
        <div className="hidden items-center gap-1.5 sm:flex">
          <Kbd>Esc</Kbd>
          <span>
            {page ? tCommon("actions.back") : tCommon("actions.close")}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Kbd>
              <HugeiconsIcon
                className="size-2.5"
                icon={ArrowUp01Icon}
                strokeWidth={2}
              />
            </Kbd>
            <Kbd>
              <HugeiconsIcon
                className="size-2.5"
                icon={ArrowDown01Icon}
                strokeWidth={2}
              />
            </Kbd>
            <span className="ml-0.5">{t("footer.navigate")}</span>
          </div>
          <div className="flex items-center gap-1">
            <Kbd>↵</Kbd>
            <span className="ml-0.5">{tCommon("actions.select")}</span>
          </div>
        </div>
      </div>
    </CommandPrimitive>
  );
}

function CommandPaletteLoading({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const { aiState, trimmedQuery } = controller;
  return (
    <div className="flex h-[14rem] flex-col items-center justify-center px-6 text-center">
      <div className="text-foreground grid grid-cols-[1.125rem_auto_1.125rem] items-center gap-2 text-sm">
        <BrailleSpinner className="text-lg leading-none" />
        <Shimmer as="span" className="font-medium">
          {aiState.status === "navigating"
            ? t(`ai.${aiState.labelKey}`)
            : tCommon("labels.thinking")}
        </Shimmer>
        <span aria-hidden="true" />
      </div>
      <p className="text-muted-foreground mt-3 max-w-xs text-xs">
        {aiState.status === "navigating"
          ? t("ai.almostThere")
          : t("ai.figuringOut", { query: trimmedQuery })}
      </p>
    </div>
  );
}

function useVisibleRoutes(hasAiCredits: boolean) {
  const navVisibility = useNavVisibility();
  return (routes: readonly CommandRoute[]) =>
    routes.filter(
      (route) =>
        isCommandRouteAvailable(route, hasAiCredits) &&
        isCommandRouteVisible(route, navVisibility)
    );
}

function CommandPaletteHome({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const hasQuery = controller.trimmedQuery.length > 0;
  return (
    <>
      <CommandPaletteEmpty controller={controller} />
      {hasQuery ? (
        <CommandPaletteSearchResults controller={controller} />
      ) : (
        <CommandPaletteStart controller={controller} />
      )}
      <CommandPaletteActions controller={controller} />
    </>
  );
}

function CommandPaletteEmpty({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const { trimmedQuery, aiState, aiModifierLabel } = controller;

  if (trimmedQuery.length < COMMAND_PALETTE_SEARCH_MIN_LENGTH) {
    return null;
  }

  if (controller.isSearchPending) {
    return (
      <CommandPrimitive.Empty>
        <div
          className="text-muted-foreground flex h-[14rem] items-center justify-center gap-2 text-sm"
          role="status"
        >
          <BrailleSpinner />
          {tCommon("states.loading")}
        </div>
      </CommandPrimitive.Empty>
    );
  }

  if (controller.isSearchError) {
    return (
      <CommandPrimitive.Empty>
        <div className="flex h-[14rem] flex-col items-center justify-center gap-3 text-sm">
          <p className="text-muted-foreground" role="status">
            {tCommon("states.error")}
          </p>
          <Button
            onClick={controller.retrySearch}
            size="sm"
            variant="secondary"
          >
            {tCommon("actions.retry")}
          </Button>
        </div>
      </CommandPrimitive.Empty>
    );
  }

  return (
    <CommandPrimitive.Empty>
      <Empty className="py-8 md:py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle className="text-base wrap-anywhere">
            {t("empty.title", { query: trimmedQuery })}
          </EmptyTitle>
          <EmptyDescription>{t("empty.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            loading={aiState.status === "loading"}
            onClick={() => {
              controller.runAiSearch().catch(() => undefined);
            }}
            size="sm"
            variant="secondary"
          >
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
            {t("ai.ask")}
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>{aiModifierLabel}</Kbd>
              <Kbd>↵</Kbd>
            </span>
          </Button>
          {aiState.status === "error" ? (
            <p className="text-destructive text-xs">{t("ai.failed")}</p>
          ) : null}
        </EmptyContent>
      </Empty>
    </CommandPrimitive.Empty>
  );
}

function CommandPaletteStart({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const visibleRoutes = useVisibleRoutes(controller.hasAiCredits);
  const recentRouteIds = new Set(
    controller.recents.flatMap((recent) =>
      recent.kind === "route" ? [recent.id] : []
    )
  );
  const recents = controller.recents.filter(
    (recent) =>
      recent.kind === "entity" ||
      visibleRoutes(
        [ROUTES_BY_ID.get(recent.id)].filter((route) => route !== undefined)
      ).length > 0
  );
  const suggested = visibleRoutes(
    COMMAND_PALETTE_SUGGESTED_ROUTES[controller.mode].flatMap((id) => {
      const route = ROUTES_BY_ID.get(id);
      return route && !recentRouteIds.has(id) ? [route] : [];
    })
  );

  return (
    <>
      {recents.length > 0 ? (
        <CommandPaletteGroup heading={t("sections.recent")}>
          {recents.map((recent) => {
            if (recent.kind === "entity") {
              return (
                <CommandPaletteItem
                  icon={COMMAND_PALETTE_ENTITY_ICONS[recent.entityKind]}
                  key={recent.key}
                  label={recent.label}
                  meta={recent.sublabel}
                  onSelect={() => controller.selectRecent(recent)}
                  value={`__recent_${recent.key}`}
                />
              );
            }
            const route = ROUTES_BY_ID.get(recent.id);
            if (!route) {
              return null;
            }
            return (
              <CommandPaletteItem
                icon={route.icon}
                key={route.id}
                label={tCommon(`labels.${COMMAND_ROUTE_LABEL_KEYS[route.id]}`)}
                meta={tCommon(COMMAND_SECTION_LABEL_KEYS[route.section])}
                onSelect={() => controller.selectRecent(recent)}
                value={`__recent_route_${route.id}`}
              />
            );
          })}
        </CommandPaletteGroup>
      ) : null}
      {suggested.length > 0 ? (
        <CommandPaletteGroup heading={t("sections.suggested")}>
          {suggested.map((route) => (
            <CommandPaletteItem
              icon={route.icon}
              key={route.id}
              label={tCommon(`labels.${COMMAND_ROUTE_LABEL_KEYS[route.id]}`)}
              meta={tCommon(COMMAND_SECTION_LABEL_KEYS[route.section])}
              onSelect={() => controller.selectRoute(route)}
              value={`__suggested_${route.id}`}
            />
          ))}
        </CommandPaletteGroup>
      ) : null}
    </>
  );
}

function CommandPaletteSearchResults({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const visibleRoutes = useVisibleRoutes(controller.hasAiCredits);
  return (
    <>
      {COMMAND_SECTIONS.map((section) => {
        const items = visibleRoutes(GROUPED_ROUTES[section]);
        if (items.length === 0) {
          return null;
        }
        const sectionLabel = tCommon(COMMAND_SECTION_LABEL_KEYS[section]);
        return (
          <CommandPaletteGroup heading={sectionLabel} key={section}>
            {items.map((route) => {
              const label = tCommon(
                `labels.${COMMAND_ROUTE_LABEL_KEYS[route.id]}`
              );
              return (
                <CommandPaletteItem
                  icon={route.icon}
                  key={route.id}
                  keywords={[route.label, sectionLabel, ...route.keywords]}
                  label={label}
                  meta={sectionLabel}
                  onSelect={() => controller.selectRoute(route)}
                  value={label}
                />
              );
            })}
          </CommandPaletteGroup>
        );
      })}

      {ENTITY_SECTION_ORDER.map((section) => {
        const items = controller.entityHitsBySection[section];
        if (items.length === 0) {
          return null;
        }
        return (
          <CommandPaletteGroup
            heading={
              section === "brandVoices" ||
              section === "chats" ||
              section === "prompts"
                ? t(`entitySections.${section}`)
                : tCommon(`labels.${section}`)
            }
            key={section}
          >
            {items.map((hit) => (
              <CommandPaletteItem
                icon={hit.icon}
                key={hit.key}
                keywords={hit.keywords}
                label={hit.label}
                meta={hit.sublabel}
                onSelect={() => controller.selectEntity(hit)}
                value={`${hit.key}__${hit.label}`}
              />
            ))}
          </CommandPaletteGroup>
        );
      })}
    </>
  );
}

function CommandPaletteActions({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const { organizations } = useOrganizationsContext();
  const { projects } = useGeoProjectsDb(controller.organizationId);
  const { isLocked: geoLocked } = useHasGeoFeature();
  const { openSettings } = useSettingsModal();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <CommandPaletteGroup heading={tCommon("labels.actions")}>
      {geoLocked ? null : (
        <CommandPaletteItem
          icon={PencilEdit01Icon}
          keywords={["write", "create", "new", "post", "article", "draft"]}
          label={t("actions.newContent")}
          onSelect={() => {
            controller.trackAction("new_content");
            controller.navigate(`/${controller.slug}${GEO_WRITER_NAV_LINK}`);
          }}
          value={`${t("actions.newContent")}__action_new_content`}
        />
      )}
      {projects.length > 1 ? (
        <CommandPaletteItem
          icon={Folder01Icon}
          keywords={["project", "switch", "change", "brand"]}
          label={t("actions.switchProject")}
          meta={t("pages.projects.count", { count: projects.length })}
          onSelect={() => controller.openPage("projects")}
          value={`${t("actions.switchProject")}__action_switch_project`}
        />
      ) : null}
      {organizations.length > 1 ? (
        <CommandPaletteItem
          icon={Building03Icon}
          keywords={["workspace", "organization", "team", "switch", "change"]}
          label={t("actions.switchWorkspace")}
          meta={t("pages.workspaces.count", { count: organizations.length })}
          onSelect={() => controller.openPage("workspaces")}
          value={`${t("actions.switchWorkspace")}__action_switch_workspace`}
        />
      ) : null}
      <CommandPaletteItem
        icon={UserAdd01Icon}
        keywords={["invite", "team", "member", "people", "add"]}
        label={t("actions.inviteMembers")}
        onSelect={() => {
          controller.trackAction("invite_members");
          controller.close();
          openSettings("members");
        }}
        value={`${t("actions.inviteMembers")}__action_invite_members`}
      />
      <CommandPaletteItem
        icon={isDark ? Sun03Icon : Moon02Icon}
        keywords={[
          "theme",
          "dark",
          "light",
          "mode",
          "appearance",
          t("actions.lightMode"),
          t("actions.darkMode"),
        ]}
        label={isDark ? t("actions.lightMode") : t("actions.darkMode")}
        onSelect={() => {
          controller.trackAction("toggle_theme");
          controller.close();
          setTheme(isDark ? "light" : "dark");
        }}
        trailing={<Kbd>{COMMAND_PALETTE_THEME_SHORTCUT}</Kbd>}
        value="__action_toggle_theme"
      />
      <CommandPaletteItem
        icon={Message01Icon}
        keywords={["feedback", "bug", "report", "idea", "feature"]}
        label={tCommon("labels.sendFeedback")}
        onSelect={controller.openFeedback}
        value={`${tCommon("labels.sendFeedback")}__action_feedback`}
      />
    </CommandPaletteGroup>
  );
}

function CommandPaletteProjectsPage({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const t = useTranslations("commandPalette");
  const { projects } = useGeoProjectsDb(controller.organizationId);
  const { data: brandData } = useBrandSettings(controller.organizationId);
  const [, setProjectParam] = useGeoProjectQueryState();
  const { projectId: activeProjectId } = useActiveProject();
  const voices = brandData?.voices ?? [];

  return (
    <CommandPaletteGroup heading={t("pages.projects.title")}>
      {projects.map((project) => {
        const domain = getWebsiteDomain(
          voices.find((voice) => voice.id === project.brandSettingsId)
            ?.websiteUrl ?? null
        );
        const isActive = project.id === activeProjectId;
        return (
          <CommandPaletteItem
            icon={Folder01Icon}
            key={project.id}
            keywords={[domain ?? ""]}
            label={project.name}
            leading={
              <ProjectLogo
                className="size-5 rounded-md"
                domain={domain}
                fallbackClassName="rounded-md"
                name={project.name}
              />
            }
            meta={domain}
            onSelect={() => {
              if (!isActive) {
                trackEvent(POSTHOG_EVENTS.GEO_PROJECT_SWITCHED, {
                  project_id: project.id,
                  project_count: projects.length,
                });
              }
              controller.close();
              if (isGeoDashboardPath(controller.pathname)) {
                setProjectParam(project.id);
                return;
              }
              setProjectParam(project.id)
                .catch(() => null)
                .finally(() => {
                  controller.navigate(
                    withGeoProject(`/${controller.slug}/geo`, project.id)
                  );
                });
            }}
            trailing={<ActiveCheck isActive={isActive} />}
            value={`${project.name}__${project.id}`}
          />
        );
      })}
    </CommandPaletteGroup>
  );
}

function CommandPaletteWorkspacesPage({
  controller,
}: {
  controller: CommandPaletteController;
}) {
  const t = useTranslations("commandPalette");
  const { organizations, activeOrganization } = useOrganizationsContext();
  const { switchOrganization } = useSwitchOrganization();

  return (
    <CommandPaletteGroup heading={t("pages.workspaces.title")}>
      {organizations.map((org) => {
        const isActive = org.id === activeOrganization?.id;
        return (
          <CommandPaletteItem
            icon={Building03Icon}
            key={org.id}
            keywords={[org.slug]}
            label={org.name}
            leading={
              <Avatar className="size-5 rounded-md after:rounded-md">
                <AvatarImage src={resolveOrganizationLogo(org.logo)} />
                <AvatarFallback className="rounded-md text-[10px]">
                  {nameInitials(org.name)}
                </AvatarFallback>
              </Avatar>
            }
            onSelect={() => {
              controller.close();
              switchOrganization(org).catch(() => undefined);
            }}
            trailing={<ActiveCheck isActive={isActive} />}
            value={`${org.name}__${org.id}`}
          />
        );
      })}
    </CommandPaletteGroup>
  );
}

function ActiveCheck({ isActive }: { isActive: boolean }) {
  if (!isActive) {
    return <span aria-hidden="true" className="size-4 shrink-0" />;
  }
  return (
    <HugeiconsIcon
      className="text-muted-foreground size-4 shrink-0"
      icon={Tick02Icon}
      strokeWidth={2}
    />
  );
}
