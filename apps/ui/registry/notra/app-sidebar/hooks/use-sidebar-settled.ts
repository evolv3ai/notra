import { useEffect, useState } from "react";

import { useSidebar } from "../../sidebar/components/sidebar";
import { SIDEBAR_COLLAPSE_MS } from "../constants/app-sidebar";

/**
 * True once the sidebar has finished collapsing to the icon rail. Swapping
 * sub-rows for a flyout any earlier would cut their fold-away animation.
 */
export function useSidebarCollapseSettled() {
  const { isMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const [settled, setSettled] = useState(collapsed);

  useEffect(() => {
    if (!collapsed) {
      setSettled(false);
      return;
    }
    const timeout = window.setTimeout(
      () => setSettled(true),
      SIDEBAR_COLLAPSE_MS
    );
    return () => window.clearTimeout(timeout);
  }, [collapsed]);

  return collapsed && settled;
}
