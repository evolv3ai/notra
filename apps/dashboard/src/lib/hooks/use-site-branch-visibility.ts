"use client";

import { useSyncExternalStore } from "react";

import { SITE_BRANCH_VISIBILITY_KEY } from "@/constants/site-branches";

// Holds the choice while browser storage refuses writes.
let override: boolean | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SITE_BRANCH_VISIBILITY_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SITE_BRANCH_VISIBILITY_KEY, onChange);
  };
}

function read() {
  if (override !== null) {
    return override;
  }
  try {
    return window.localStorage.getItem(SITE_BRANCH_VISIBILITY_KEY) === "true";
  } catch {
    return false;
  }
}

/** Per-user preference to keep the branch selector on an unprotected deployment branch. */
export function useSiteBranchVisibility() {
  const show = useSyncExternalStore(subscribe, read, () => false);
  const setShow = (next: boolean) => {
    try {
      window.localStorage.setItem(SITE_BRANCH_VISIBILITY_KEY, String(next));
      override = null;
    } catch {
      override = next;
    }
    window.dispatchEvent(new Event(SITE_BRANCH_VISIBILITY_KEY));
  };
  return { show, setShow };
}
