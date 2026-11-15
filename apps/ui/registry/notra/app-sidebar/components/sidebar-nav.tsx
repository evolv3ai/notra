"use client";

import { cn } from "cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../../dropdown-menu/components/dropdown-menu";
import {
  SidebarLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuCollapsible,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuSubPanel,
} from "../../sidebar/components/sidebar";
import { SIDEBAR_NAV_BADGE_CLASS_NAME } from "../constants/app-sidebar";
import { useSidebarCollapseSettled } from "../hooks/use-sidebar-settled";
import type {
  SidebarLinkRender,
  SidebarNavGroup,
  SidebarNavProps,
} from "../types/app-sidebar";

const defaultLinkRender: SidebarLinkRender = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

function NavBadge({ children }: { children?: string }) {
  if (!children) {
    return null;
  }
  return <span className={SIDEBAR_NAV_BADGE_CLASS_NAME}>{children}</span>;
}

function SidebarNavRow({
  group,
  activeHref,
  linkRender,
  collapsed,
}: {
  group: SidebarNavGroup;
  activeHref?: string | null;
  linkRender: SidebarLinkRender;
  collapsed: boolean;
}) {
  const items = group.items ?? [];
  const Icon = group.icon;
  const listsOwnPage = items.some((item) => item.href === group.href);
  const groupActive =
    group.href === activeHref || items.some((item) => item.href === activeHref);
  const ownPageActive = group.href === activeHref && !listsOwnPage;

  if (collapsed && items.length > 0) {
    const flyoutItems = listsOwnPage ? items : [group, ...items];

    return (
      <SidebarMenuCollapsible>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                aria-label={group.title}
                isActive={groupActive}
                tooltip={group.title}
              >
                <Icon />
                <SidebarLabel>{group.title}</SidebarLabel>
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="min-w-48"
            side="right"
            align="start"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
              {flyoutItems.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  nativeButton={false}
                  render={(props) => linkRender({ ...props, href: item.href })}
                  aria-current={item.href === activeHref ? "page" : undefined}
                  className="aria-[current=page]:font-medium"
                >
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <NavBadge>{item.badge}</NavBadge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuCollapsible>
    );
  }

  return (
    <SidebarMenuCollapsible open={groupActive && items.length > 0}>
      <SidebarMenuButton
        isActive={ownPageActive}
        aria-current={ownPageActive ? "page" : undefined}
        className={cn(groupActive && !ownPageActive && "font-medium")}
        render={(props) => linkRender({ ...props, href: group.href })}
        tooltip={group.title}
      >
        <Icon />
        <SidebarLabel>{group.title}</SidebarLabel>
        <NavBadge>
          {groupActive && items.length > 0 ? undefined : group.badge}
        </NavBadge>
      </SidebarMenuButton>
      {items.length > 0 ? (
        <SidebarMenuSubPanel>
          <SidebarMenuSub className="mt-0.5">
            {items.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton
                  isActive={item.href === activeHref}
                  aria-current={item.href === activeHref ? "page" : undefined}
                  render={(props) => linkRender({ ...props, href: item.href })}
                >
                  <span>{item.title}</span>
                  <NavBadge>{item.badge}</NavBadge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </SidebarMenuSubPanel>
      ) : null}
    </SidebarMenuCollapsible>
  );
}

/**
 * Grouped navigation from the Notra dashboard. Each row reveals its related
 * pages while one of them is active. Collapsed to the icon rail, rows keep a
 * tooltip and rows with pages open them in a flyout menu.
 */
export function SidebarNav({
  groups,
  activeHref,
  linkRender = defaultLinkRender,
  className,
}: SidebarNavProps) {
  const collapsed = useSidebarCollapseSettled();

  return (
    <SidebarMenu className={className}>
      {groups.map((group) => (
        <SidebarNavRow
          key={group.href}
          activeHref={activeHref}
          collapsed={collapsed}
          group={group}
          linkRender={linkRender}
        />
      ))}
    </SidebarMenu>
  );
}
