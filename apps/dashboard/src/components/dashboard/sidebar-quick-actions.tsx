"use client";

import { SearchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { Kbd } from "@notra/ui/components/ui/kbd";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@notra/ui/components/ui/sidebar";
import { useIsApplePlatform } from "@notra/ui/hooks/use-is-apple-platform";
import { useTranslations } from "use-intl";

import { useCommandPalette } from "@/components/command-palette/command-palette-context";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { AgentIcon } from "@/components/icons/agent-icon";
import { useDevVariant } from "@/lib/hooks/use-dev-variant";

import { SidebarLabel } from "./sidebar-label";

function SidebarSearchField() {
  const t = useTranslations("common.actions");
  const { setOpen } = useCommandPalette();
  const isApplePlatform = useIsApplePlatform();
  const label = t("search");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-label={label}
        className="border-sidebar-border text-muted-foreground hover:text-sidebar-foreground group-data-[collapsible=icon]:text-sidebar-foreground h-9 cursor-pointer rounded-lg border group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:border-transparent"
        onClick={() => setOpen(true)}
        tooltip={label}
      >
        <HugeiconsIcon icon={SearchIcon} />
        <SidebarLabel>{`${label}…`}</SidebarLabel>
        <Kbd className="border-sidebar-border ml-auto rounded-[5px] border bg-transparent px-1.5">
          {isApplePlatform ? "⌘K" : "Ctrl K"}
        </Kbd>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function SidebarAskAgentButton() {
  const t = useTranslations("common.labels");
  const { active, togglePanel } = useRightPanel();
  const buttonVariant = useDevVariant(
    "ask-agent-style",
    ["secondary", "outline"] as const,
    "secondary"
  );
  const label = t("askAgent");

  return (
    <Button
      aria-label={label}
      aria-pressed={active === "agent"}
      className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0"
      onClick={() => togglePanel("agent")}
      title={label}
      variant={buttonVariant}
    >
      <AgentIcon />
      <span className="group-data-[collapsible=icon]:hidden">{label}</span>
    </Button>
  );
}

/** Search field above the navigation, styled like an input. */
export function SidebarTopQuickActions() {
  return (
    <SidebarMenu className="px-2 pt-2.5 pb-3">
      <SidebarSearchField />
    </SidebarMenu>
  );
}
