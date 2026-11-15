"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../dropdown-menu/components/dropdown-menu";
import {
  SidebarLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../../sidebar/components/sidebar";
import type { SidebarSwitcherProps } from "../types/app-sidebar";

/**
 * The project switcher at the top of the sidebar. Put the trigger beside it
 * with `SidebarHeaderRow`, which moves it under the switcher when collapsed.
 */
export function SidebarSwitcher({
  options,
  value,
  onValueChange,
  label = "Projects",
  actions,
}: SidebarSwitcherProps) {
  const active = options.find((option) => option.value === value) ?? options[0];
  if (!active) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={active.label}
                className="[--sidebar-lg-icon:1.75rem]"
              />
            }
          >
            <SwitcherIcon>{active.icon}</SwitcherIcon>
            <div className="grid min-w-0 flex-1 leading-tight">
              <SidebarLabel className="text-sm font-medium">
                {active.label}
              </SidebarLabel>
              {active.description ? (
                <SidebarLabel className="text-muted-foreground text-xs">
                  {active.description}
                </SidebarLabel>
              ) : null}
            </div>
            <ChevronsUpDownIcon className="text-muted-foreground ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{label}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={value}
                onValueChange={onValueChange}
              >
                {options.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    <SwitcherIcon small>{option.icon}</SwitcherIcon>
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            {actions ? (
              <>
                <DropdownMenuSeparator />
                {actions}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SwitcherIcon({
  children,
  small = false,
}: {
  children?: ReactNode;
  small?: boolean;
}) {
  return (
    <span
      className={
        small
          ? "bg-sidebar-accent flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md text-[0.625rem] font-semibold"
          : "bg-sidebar-accent flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-semibold"
      }
    >
      {children}
    </span>
  );
}

/**
 * Holds the switcher with the sidebar trigger. The trigger sits beside the
 * switcher while expanded and moves below it on the icon rail, animated with
 * the sidebar width instead of jumping when the header reflows.
 */
export function SidebarHeaderRow({
  children,
  trigger,
}: {
  children: ReactNode;
  trigger: ReactNode;
}) {
  const { isMobile } = useSidebar();
  if (isMobile) {
    return children;
  }

  return (
    <div className="relative pr-8 transition-[padding] duration-(--sidebar-duration) ease-(--sidebar-ease) group-data-[collapsible=icon]:pr-0 group-data-[collapsible=icon]:pb-8 motion-reduce:transition-none">
      {children}
      <div className="absolute top-2.5 left-[calc(100%-1.75rem)] flex transition-[left,top] duration-(--sidebar-duration) ease-(--sidebar-ease) group-data-[collapsible=icon]:top-13 group-data-[collapsible=icon]:left-0.5 motion-reduce:transition-none">
        {trigger}
      </div>
    </div>
  );
}
