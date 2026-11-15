"use client";

import { useSidebar } from "@notra/ui/components/ui/sidebar";
import { useEffect, useState } from "react";

import { SIDEBAR_TRANSITION_MS } from "@/constants/nav";

/**
 * True once the desktop sidebar has finished collapsing. Rows that render a
 * different element when collapsed wait for this, so their labels fade out
 * with the rest instead of being swapped away on the first frame.
 */
export function useSidebarCollapseSettled() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const [settled, setSettled] = useState(collapsed);

  useEffect(() => {
    // The width transition is disabled under reduced motion, so nothing to wait for.
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const timeout = window.setTimeout(
      () => setSettled(collapsed),
      collapsed && !reducedMotion ? SIDEBAR_TRANSITION_MS : 0
    );
    return () => window.clearTimeout(timeout);
  }, [collapsed]);

  return collapsed && settled;
}
