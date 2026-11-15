import type { IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";
import type { useTranslations } from "use-intl";

import type { NavVisibility } from "@/types/components/nav";
import type { SettingsSectionId } from "@/types/settings/modal";

export type CommandSection =
  | "Navigation"
  | "GEO"
  | "Workspace"
  | "Automation"
  | "Manage"
  | "Settings";

export type CommandRouteId =
  | "home"
  | "chat"
  | "analytics"
  | "autopilot"
  | "geo"
  | "geo-traffic"
  | "geo-prompts"
  | "geo-personas"
  | "geo-gaps"
  | "geo-shelf-space"
  | "geo-competitors"
  | "geo-write"
  | "geo-settings-brand"
  | "geo-settings-languages"
  | "geo-settings-models"
  | "content"
  | "sites"
  | "brand-company-info"
  | "brand-references"
  | "automations"
  | "api-keys"
  | "integrations"
  | "github-integration"
  | "logs"
  | "settings-account"
  | "settings-general"
  | "settings-members"
  | "settings-notifications"
  | "settings-billing"
  | "settings-usage"
  | "settings-credits";

export interface CommandRoute {
  id: CommandRouteId;
  label: string;
  keywords: string[];
  icon: IconSvgElement;
  section: CommandSection;
  path: (slug: string) => string;
  requiresAiCredits?: boolean;
  settingsSection?: SettingsSectionId;
  /** Hidden unless this feature flag is on for the workspace. */
  flag?: keyof NavVisibility;
}

export type AiResult =
  | { action: "navigate"; path: string; reason: string }
  | { action: "chat"; path: null; reason: string };

interface CommandPaletteNavigationTarget {
  label: string;
  path: string;
}

export interface CommandPaletteNavigationEntity extends CommandPaletteNavigationTarget {
  type: CommandPaletteEntityKind;
}

export interface ResolveNavigationWithJevParams {
  query: string;
  routes: readonly (CommandPaletteNavigationTarget & {
    section: CommandSection;
    keywords: readonly string[];
  })[];
  entities: readonly CommandPaletteNavigationEntity[];
  organizationId: string;
  abortSignal?: AbortSignal;
}

export type CommandPaletteEntityKind =
  | "post"
  | "voice"
  | "reference"
  | "github"
  | "linear"
  | "social"
  | "prompt"
  | "competitor"
  | "persona"
  | "site"
  | "chat";

export interface CommandPaletteEntityTarget {
  kind: CommandPaletteEntityKind;
  id: string;
  name: string;
}

type CommandPaletteMode = "geo" | "studio";

export type CommandPalettePage = "projects" | "workspaces";

export type CommandPaletteRecent =
  | { kind: "route"; id: CommandRouteId }
  | {
      kind: "entity";
      key: string;
      entityKind: CommandPaletteEntityKind;
      label: string;
      sublabel?: string;
      path: string;
    };

export interface CommandPaletteItemProps {
  icon: IconSvgElement;
  label: ReactNode;
  value: string;
  onSelect: () => void;
  keywords?: string[];
  /** Muted text on the right, e.g. the section or entity details. */
  meta?: ReactNode;
  /** Replaces the hover arrow, e.g. a shortcut or a check mark. */
  trailing?: ReactNode;
  disabled?: boolean;
  iconClassName?: string;
  leading?: ReactNode;
}

export interface CommandPaletteGroupProps {
  heading: string;
  children: ReactNode;
}

export interface EntityHit {
  key: string;
  kind: CommandPaletteEntityKind;
  label: string;
  sublabel?: string;
  icon: IconSvgElement;
  path: string;
  keywords: string[];
}

export interface CommandPaletteSearchData {
  posts: readonly {
    id: string;
    title: string;
    status: string;
    slug: string | null;
  }[];
  voices: readonly {
    id: string;
    name: string;
    companyName: string | null;
    websiteUrl: string | null;
  }[];
  references: readonly {
    id: string;
    type: string;
    content: string;
    note: string | null;
  }[];
  githubIntegrations: readonly {
    id: string;
    displayName: string;
    owner: string | null;
    repo: string | null;
  }[];
  linearIntegrations: readonly {
    id: string;
    displayName: string;
    linearOrganizationName: string | null;
    linearTeamName: string | null;
  }[];
  socialAccounts: readonly {
    id: string;
    displayName: string;
    provider: string;
    username: string;
  }[];
  prompts: readonly {
    id: string;
    prompt: string;
    title: string | null;
    enabled: boolean;
  }[];
  competitors: readonly { id: string; name: string; domain: string | null }[];
  personas: readonly {
    id: string;
    name: string;
    role: string;
    company: string;
  }[];
  sites: readonly { id: string; name: string; publicOrigin: string }[];
  chats: readonly { id: string; title: string }[];
}

export type EntityHitSection =
  | "prompts"
  | "competitors"
  | "personas"
  | "posts"
  | "chats"
  | "sites"
  | "brandVoices"
  | "references"
  | "integrations";

export type CommandPaletteTranslator = ReturnType<
  typeof useTranslations<"commandPalette">
>;

type CommandPaletteNavigatingLabelKey = "opening" | "openingChat";

export type EntityHitsBySection = Record<EntityHitSection, EntityHit[]>;

export interface CommandPaletteEntitySearchResult {
  entityHitsBySection: EntityHitsBySection;
  isSearchPending: boolean;
  isSearchError: boolean;
  retrySearch: () => void;
}

export type CommandPaletteAiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "navigating"; labelKey: CommandPaletteNavigatingLabelKey }
  | { status: "error" };

export interface CommandPaletteController {
  slug: string;
  organizationId: string;
  mode: CommandPaletteMode;
  pathname: string;
  query: string;
  trimmedQuery: string;
  page: CommandPalettePage | null;
  aiState: CommandPaletteAiState;
  aiModifierLabel: string;
  hasAiCredits: boolean;
  entityHitsBySection: EntityHitsBySection;
  recents: readonly CommandPaletteRecent[];
  isSearchPending: boolean;
  close: () => void;
  isSearchError: boolean;
  retrySearch: () => void;
  navigate: (path: string) => void;
  selectRoute: (route: CommandRoute) => void;
  selectEntity: (hit: EntityHit) => void;
  selectRecent: (recent: CommandPaletteRecent) => void;
  trackAction: (id: string) => void;
  openFeedback: () => void;
  openPage: (page: CommandPalettePage) => void;
  closePage: () => void;
  runAiSearch: () => Promise<void>;
  changeQuery: (value: string) => void;
}

export interface UseCommandPaletteEntitySearchParams {
  open: boolean;
  /** False on sub pages and while AI navigation runs. */
  enabled: boolean;
  organizationId: string;
  projectId: string | null;
  isProjectResolved: boolean;
  slug: string;
  query: string;
}

export interface UseCommandPaletteAiParams {
  query: string;
  slug: string;
  projectId: string | null;
  close: () => void;
  openSettings: (section: SettingsSectionId) => void;
  /** Pushes a dashboard path, scoped to the active GEO project. */
  pushPath: (path: string) => void;
}
