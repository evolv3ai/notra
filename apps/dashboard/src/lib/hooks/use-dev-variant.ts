"use client";

import { useSyncExternalStore } from "react";

const STORAGE_PREFIX = "notra:dev-variant:";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Storage can be blocked, so the query value still applies without it. */
function syncStoredVariant(
  storageKey: string,
  fromQuery: string | null
): string | null {
  try {
    if (fromQuery === "") {
      window.localStorage.removeItem(storageKey);
    } else if (fromQuery !== null) {
      window.localStorage.setItem(storageKey, fromQuery);
    }
    return window.localStorage.getItem(storageKey);
  } catch {
    return fromQuery;
  }
}

/**
 * Design review switch for comparing variants in the real app. A
 * `?variant.<key>=<value>` query sticks in localStorage until cleared with
 * `?variant.<key>=`. Always the fallback outside development.
 */
export function useDevVariant<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T
): T {
  const read = () => {
    if (process.env.NODE_ENV !== "development") {
      return fallback;
    }
    const fromQuery = new URLSearchParams(window.location.search).get(
      `variant.${key}`
    );
    const stored = syncStoredVariant(`${STORAGE_PREFIX}${key}`, fromQuery);
    return options.find((option) => option === stored) ?? fallback;
  };

  return useSyncExternalStore(subscribe, read, () => fallback);
}
