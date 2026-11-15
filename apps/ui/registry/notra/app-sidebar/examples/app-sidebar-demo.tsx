import { LogOutIcon, PlusIcon, SettingsIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../dropdown-menu/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "../../sidebar/components/sidebar";
import { SidebarNav } from "../components/sidebar-nav";
import { SidebarSearch } from "../components/sidebar-search";
import {
  SidebarHeaderRow,
  SidebarSwitcher,
} from "../components/sidebar-switcher";
import { SidebarUserMenu } from "../components/sidebar-user-menu";
import {
  DEMO_FOOTER_GROUPS,
  DEMO_NAV_GROUPS,
  DEMO_PAGE_TITLES,
  DEMO_PROJECTS,
} from "../constants/app-sidebar-demo";
import type { SidebarLinkRender } from "../types/app-sidebar";

// The preview frame is padded, so the sidebar sits in the shell instead of
// being fixed to the viewport as it is in an app.
const DEMO_SHELL_CLASS_NAME =
  "relative h-160 min-h-0 overflow-hidden [&_[data-slot=sidebar-container]]:absolute [&_[data-slot=sidebar-container]]:h-full";

function MobileTrigger() {
  const { isMobile } = useSidebar();
  return isMobile ? <SidebarTrigger /> : null;
}

export default function AppSidebarDemo({
  defaultOpen = true,
  defaultHref = "#traffic",
}: {
  defaultOpen?: boolean;
  defaultHref?: string;
}) {
  const [project, setProject] = useState("notra");
  const [activeHref, setActiveHref] = useState(defaultHref);
  const linkRender: SidebarLinkRender = ({ children, ...props }) => (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        setActiveHref(props.href);
      }}
    >
      {children}
    </a>
  );

  return (
    <SidebarProvider
      className={DEMO_SHELL_CLASS_NAME}
      defaultOpen={defaultOpen}
      keyboardShortcut={null}
      mobileBreakpoint={480}
    >
      <Sidebar collapsible="icon" variant="inset" className="border-none">
        <SidebarHeader className="pt-px pb-0.5">
          <SidebarHeaderRow trigger={<SidebarTrigger />}>
            <SidebarSwitcher
              options={DEMO_PROJECTS}
              value={project}
              onValueChange={setProject}
              actions={
                <>
                  <DropdownMenuItem>
                    <PlusIcon />
                    New project
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <SettingsIcon />
                    Project settings
                  </DropdownMenuItem>
                </>
              }
            />
          </SidebarHeaderRow>
        </SidebarHeader>
        <div className="px-2 pt-2.5 pb-3">
          <SidebarSearch />
        </div>
        <SidebarContent>
          <SidebarGroup className="py-0">
            <SidebarNav
              groups={DEMO_NAV_GROUPS}
              activeHref={activeHref}
              linkRender={linkRender}
            />
          </SidebarGroup>
          <SidebarGroup className="mt-auto gap-2 pb-0">
            <SidebarNav
              groups={DEMO_FOOTER_GROUPS}
              activeHref={activeHref}
              linkRender={linkRender}
            />
            <Button
              variant="secondary"
              className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0"
              aria-label="Ask agent"
            >
              <SparklesIcon className="hidden group-data-[collapsible=icon]:block" />
              <span className="group-data-[collapsible=icon]:hidden">
                Ask agent
              </span>
            </Button>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="pt-2">
          <SidebarUserMenu name="Ada Lovelace" description="Notra" badge="Pro">
            <DropdownMenuItem>
              <SettingsIcon />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </SidebarUserMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <MobileTrigger />
          <h1 className="text-sm font-medium">
            {DEMO_PAGE_TITLES[activeHref] ?? "Overview"}
          </h1>
        </header>
        <div className="grid flex-1 auto-rows-min gap-4 p-4 sm:grid-cols-3">
          <div className="bg-muted/60 aspect-video rounded-xl" />
          <div className="bg-muted/60 aspect-video rounded-xl" />
          <div className="bg-muted/60 aspect-video rounded-xl" />
          <div className="bg-muted/60 h-64 rounded-xl sm:col-span-3" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
