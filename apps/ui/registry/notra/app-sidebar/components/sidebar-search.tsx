"use client";

import { SearchIcon } from "lucide-react";

import { Kbd } from "@/components/ui/kbd";

import {
  SidebarLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../sidebar/components/sidebar";
import type { SidebarSearchProps } from "../types/app-sidebar";

/**
 * A search row styled like a field that opens your command palette. On the
 * icon rail it becomes a plain icon button with a tooltip.
 */
export function SidebarSearch({
  label = "Search",
  shortcut = "⌘K",
  onClick,
}: SidebarSearchProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label={label}
          aria-keyshortcuts={shortcut === "⌘K" ? "Meta+K" : undefined}
          className="border-sidebar-border text-muted-foreground hover:text-sidebar-foreground group-data-[collapsible=icon]:text-sidebar-foreground h-9 rounded-lg border transition-[background-color,color,border-color,height] group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:border-transparent"
          onClick={onClick}
          tooltip={label}
        >
          <SearchIcon />
          <SidebarLabel>{`${label}…`}</SidebarLabel>
          {shortcut ? (
            <Kbd className="border-sidebar-border ml-auto rounded-[5px] border bg-transparent px-1.5">
              {shortcut}
            </Kbd>
          ) : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
