"use client";

import { ChevronsUpDownIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../dropdown-menu/components/dropdown-menu";
import {
  SidebarLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../../sidebar/components/sidebar";
import { SIDEBAR_NAV_BADGE_CLASS_NAME } from "../constants/app-sidebar";
import type { SidebarUserMenuProps } from "../types/app-sidebar";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** The account row at the bottom of the sidebar with its menu. */
export function SidebarUserMenu({
  name,
  description,
  avatarSrc,
  badge,
  children,
}: SidebarUserMenuProps) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={name}
                className="data-popup-open:ring-sidebar-border/70 data-popup-open:ring-1"
              />
            }
          >
            <Avatar className="size-8 rounded-lg after:rounded-lg">
              {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
              <AvatarFallback className="bg-sidebar-accent rounded-lg text-xs font-medium">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 leading-tight">
              <SidebarLabel className="text-sm font-medium">
                {name}
              </SidebarLabel>
              {description ? (
                <SidebarLabel className="text-muted-foreground text-xs">
                  {description}
                </SidebarLabel>
              ) : null}
            </div>
            {badge ? (
              <span className={SIDEBAR_NAV_BADGE_CLASS_NAME}>{badge}</span>
            ) : null}
            <ChevronsUpDownIcon
              className={
                badge
                  ? "text-muted-foreground"
                  : "text-muted-foreground ml-auto"
              }
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56"
            side={isMobile ? "bottom" : "top"}
            align="start"
            sideOffset={6}
          >
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
