import type { IconSvgElement } from "@hugeicons/react";
import type { PostStatus } from "@notra/schemas/dashboard/content";
import type { ReactNode } from "react";

export type SidebarMode = "geo" | "studio";
type NavItemLabelKey =
  | "home"
  | "chat"
  | "content"
  | "sites"
  | "analytics"
  | "feedback"
  | "brandIdentityTitle"
  | "autopilot"
  | "automations"
  | "integrations"
  | "overview"
  | "traffic"
  | "prompts"
  | "contentGaps"
  | "shelfSpace"
  | "agentReadiness"
  | "competitors"
  | "personas"
  | "geoSettings"
  | "skills"
  | "apiKeys";

type NavBadgeKey = "beta";

type NavGroupLabelKey =
  | "autopilot"
  | "overview"
  | "prompts"
  | "competitors"
  | "improve"
  | "automations"
  | "content"
  | "sites"
  | "feedback"
  | "workspace";

/**
 * One sidebar row. The first visible link is the row's own page; the rest show
 * as sub-rows while the row is active, so a row never repeats its own name.
 */
export interface NavGroup {
  id: NavGroupLabelKey;
  icon: IconSvgElement;
  labelKey: NavGroupLabelKey;
  links: readonly string[];
  /**
   * The row is a heading for its pages rather than a page of its own, so its
   * first page is listed underneath like the others.
   */
  listsOwnPage?: boolean;
}

export interface NavGroupRowState {
  subRows: NavMainItem[];
  groupActive: boolean;
  ownPageActive: boolean;
  showSubRows: boolean;
  showOwnBadge: boolean;
}

interface NavItem {
  link: string;
  icon: IconSvgElement;
  labelKey: NavItemLabelKey;
}

export interface NavMainItem extends NavItem {
  badge?: NavBadgeKey;
}

export interface SidebarModeOption {
  id: SidebarMode;
  label: string;
  descriptionKey: "measureVisibility" | "createContent";
  icon: IconSvgElement;
}

export interface NavPrimaryActionConfig {
  icon: IconSvgElement;
}

export interface NavVisibility {
  autopilot: boolean;
  analytics: boolean;
  sites: boolean;
}

export interface PendingSidebarMode {
  mode: SidebarMode;
  route: string | undefined;
}

export interface UseSidebarModeResult {
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
  /** Set while the route has not caught up with the user's pick, else null. */
  pendingMode: SidebarMode | null;
}

export interface NavLockHintProps {
  message: string;
  className?: string;
}

export type SidebarSwapSide = "left" | "right";

export interface SidebarSwapItem {
  id: string;
  side: SidebarSwapSide;
  className?: string;
  children: ReactNode;
}

export interface SidebarSwapProps {
  activeId: string;
  items: readonly SidebarSwapItem[];
  /** Keep every panel mounted. Use when both sides stay cheap to hold. */
  keepMounted?: boolean;
  className?: string;
}
