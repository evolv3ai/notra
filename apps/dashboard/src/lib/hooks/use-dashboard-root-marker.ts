"use client";

import { useEffect } from "react";

import { DASHBOARD_ROOT_ATTRIBUTE } from "@/constants/dashboard-shell";

/**
 * Marks <html> while the dashboard shell is mounted so CSS can turn off the
 * rubber-band bounce. `html:has([data-dashboard-shell])` did the same, but made
 * every DOM change restyle the whole document (seconds of main-thread time on
 * table-heavy pages like GEO traffic).
 */
export function useDashboardRootMarker() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(DASHBOARD_ROOT_ATTRIBUTE, "");
    return () => root.removeAttribute(DASHBOARD_ROOT_ATTRIBUTE);
  }, []);
}
