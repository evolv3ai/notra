"use client";

import { useSyncExternalStore } from "react";

import { localStorageKeys } from "@/constants/storage";
import type { ContentPanelTab } from "@/types/content/overview";

let activeTab: ContentPanelTab = "overview";
/** Null while no post page is mounted. */
let hasOverview: boolean | null = null;
let hasPreview = false;
let focusRequested = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setContentPanelTab(tab: ContentPanelTab) {
  if (tab === activeTab) {
    return;
  }
  activeTab = tab;
  notify();
}

/** Switches tabs from the keyboard and keeps focus on the tab strip. */
export function focusContentPanelTab(tab: ContentPanelTab) {
  focusRequested = true;
  setContentPanelTab(tab);
}

/** True once after focusContentPanelTab, for the newly mounted tab strip. */
export function takeContentPanelTabFocus(): boolean {
  const requested = focusRequested;
  focusRequested = false;
  return requested;
}

function getContentPanelTab(): ContentPanelTab {
  return activeTab;
}

export function useContentPanelTab(): ContentPanelTab {
  return useSyncExternalStore(subscribe, getContentPanelTab, () => "overview");
}

/** Set by the post page while its panel offers the overview tab. */
export function setContentPanelHasOverview(value: boolean | null) {
  if (value === hasOverview) {
    return;
  }
  hasOverview = value;
  notify();
}

function getContentPanelHasOverview() {
  return hasOverview;
}

/** Null until the post page mounts, so the header can wait for it. */
export function useContentPanelHasOverview(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    getContentPanelHasOverview,
    () => null
  );
}

/** Set by the post page while its panel offers the site preview tab. */
export function setContentPanelHasPreview(value: boolean) {
  if (value === hasPreview) {
    return;
  }
  hasPreview = value;
  if (!value && activeTab === "preview") {
    activeTab = hasOverview ? "overview" : "agent";
  }
  notify();
}

function getContentPanelHasPreview() {
  return hasPreview;
}

export function useContentPanelHasPreview(): boolean {
  return useSyncExternalStore(
    subscribe,
    getContentPanelHasPreview,
    () => false
  );
}

/** The panel opens with each post until someone closes it on purpose. */
export function isContentPanelDismissed(): boolean {
  try {
    return localStorage.getItem(localStorageKeys.contentPanelClosed) === "1";
  } catch {
    return false;
  }
}

export function setContentPanelDismissed(dismissed: boolean) {
  try {
    if (dismissed) {
      localStorage.setItem(localStorageKeys.contentPanelClosed, "1");
    } else {
      localStorage.removeItem(localStorageKeys.contentPanelClosed);
    }
  } catch {
    // Private mode or storage full: the panel just opens again next time.
  }
}
