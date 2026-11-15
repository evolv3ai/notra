import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

export interface SidebarNavLink {
  title: string;
  href: string;
  /** A short tag after the label, such as "Beta". */
  badge?: string;
}

/**
 * One row per job. The row opens `href`, and its `items` are revealed
 * underneath while the row or one of them is the active page. In the
 * collapsed rail a row with items opens them in a flyout instead.
 */
export interface SidebarNavGroup extends SidebarNavLink {
  icon: LucideIcon;
  items?: readonly SidebarNavLink[];
}

/**
 * Renders a row's link. Spread the props onto your router's link, for example
 * `({ href, ...props }) => <Link {...props} to={href} />`.
 */
export type SidebarLinkRender = (
  props: ComponentProps<"a"> & { href: string }
) => ReactElement;

export interface SidebarNavProps {
  groups: readonly SidebarNavGroup[];
  activeHref?: string | null;
  linkRender?: SidebarLinkRender;
  className?: string;
}

export interface SidebarSwitcherOption {
  value: string;
  label: string;
  description?: string;
  /** A 28px square, such as a logo or an initial. */
  icon?: ReactNode;
}

export interface SidebarSwitcherProps {
  options: readonly SidebarSwitcherOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** Heading above the options in the menu. */
  label?: string;
  /** Extra menu items under the options, such as "New project". */
  actions?: ReactNode;
}

export interface SidebarSearchProps {
  label?: string;
  shortcut?: string;
  onClick?: () => void;
}

export interface SidebarUserMenuProps {
  name: string;
  description?: string;
  avatarSrc?: string;
  badge?: string;
  /** Menu items. */
  children: ReactNode;
}
