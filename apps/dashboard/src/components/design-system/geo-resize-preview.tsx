import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@notra/ui/components/ui/sidebar";
import type { ReactNode } from "react";

import { SidebarResizeHandle } from "@/components/dashboard/sidebar-resize-handle";
import { SIDEBAR_DEFAULT_WIDTH } from "@/constants/nav";
import { useSidebarWidth } from "@/lib/hooks/use-sidebar-width";
import type { DashboardSidebarStyle } from "@/types/components/dashboard-shell";

export function GeoResizePreview({ children }: { children: ReactNode }) {
  const {
    finishSidebarResize,
    setSidebarWidth,
    sidebarResizing,
    sidebarWidth,
    startSidebarResize,
  } = useSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  const style: DashboardSidebarStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
  };

  return (
    <SidebarProvider
      className="relative min-h-0! overflow-hidden rounded-xl border [&_[data-slot=sidebar-container]]:absolute! [&_[data-slot=sidebar-container]]:h-full! [&_[data-slot=sidebar-container]]:transition-none! [&_[data-slot=sidebar-gap]]:transition-none!"
      defaultOpen
      style={style}
    >
      <Sidebar collapsible="icon">
        <SidebarContent className="gap-3 p-4">
          <span className="truncate text-sm font-medium">
            GEO resize preview
          </span>
          <span className="text-muted-foreground text-xs">
            Synthetic data · drag the sidebar edge
          </span>
        </SidebarContent>
        <SidebarResizeHandle
          onWidthChange={setSidebarWidth}
          onWidthChangeEnd={finishSidebarResize}
          onWidthChangeStart={startSidebarResize}
          width={sidebarWidth}
        />
      </Sidebar>
      <SidebarInset
        className="min-w-0 p-3"
        data-resizing={sidebarResizing || undefined}
      >
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
