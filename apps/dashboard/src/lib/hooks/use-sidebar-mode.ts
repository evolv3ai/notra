"use client";

import { useEffect, useSyncExternalStore } from "react";

import { localStorageKeys } from "@/constants/storage";
import type {
  PendingSidebarMode,
  SidebarMode,
  UseSidebarModeResult,
} from "@/types/components/nav";
import { setSidebarModeCookie } from "@/utils/cookies";
import { isSidebarMode, resolveSidebarMode } from "@/utils/nav";

const SIDEBAR_MODE_EVENT = "notra:sidebar-mode-change";

let pendingMode: PendingSidebarMode | null = null;

function readStoredMode(): SidebarMode | null {
  try {
    const value = window.localStorage.getItem(localStorageKeys.sidebarMode);
    return isSidebarMode(value) ? value : null;
  } catch {
    return null;
  }
}

function readPendingMode(): PendingSidebarMode | null {
  return pendingMode;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_MODE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_MODE_EVENT, onChange);
  };
}

function notifyModeChange(): void {
  window.dispatchEvent(new Event(SIDEBAR_MODE_EVENT));
}

function persistMode(mode: SidebarMode): void {
  try {
    window.localStorage.setItem(localStorageKeys.sidebarMode, mode);
  } catch {
    // Private browsing can block localStorage; the cookie still restores
    // the next dashboard open.
  }
  setSidebarModeCookie(mode).catch(() => {});
  notifyModeChange();
}

function clearPendingMode(expected: PendingSidebarMode): void {
  if (pendingMode !== expected) {
    return;
  }
  pendingMode = null;
  notifyModeChange();
}

/**
 * Pick a sidebar mode from the route it is picked in. Persists the mode
 * synchronously so a navigation issued right after already carries the updated
 * cookie, and keeps the pick pinned until the route changes so the route-derived
 * mode cannot write the old mode back in between.
 */
export function pickSidebarMode(
  mode: SidebarMode,
  route: string | undefined
): void {
  pendingMode = { mode, route };
  persistMode(mode);
}

export function useSidebarMode(
  route: string | undefined
): UseSidebarModeResult {
  const storedMode = useSyncExternalStore(
    subscribe,
    readStoredMode,
    getServerSnapshot
  );
  const pending = useSyncExternalStore(
    subscribe,
    readPendingMode,
    getServerSnapshot
  );
  const routeMode = resolveSidebarMode(route, storedMode);

  const mode =
    pending !== null && pending.route === route ? pending.mode : routeMode;

  useEffect(
    () => () => {
      const pendingAtUnmount = readPendingMode();
      if (pendingAtUnmount !== null) {
        clearPendingMode(pendingAtUnmount);
      }
    },
    []
  );

  useEffect(() => {
    if (pending !== null && pending.route !== route) {
      clearPendingMode(pending);
    }
  }, [pending, route]);

  useEffect(() => {
    if (route === undefined) {
      return;
    }
    if (storedMode !== mode) {
      persistMode(mode);
    }
  }, [mode, route, storedMode]);

  const setMode = (next: SidebarMode) => {
    pickSidebarMode(next, route);
  };

  return { mode, setMode, pendingMode: mode === routeMode ? null : mode };
}

export function useStoredSidebarMode(): SidebarMode | null {
  return useSyncExternalStore(subscribe, readStoredMode, getServerSnapshot);
}
