"use client";
import { createContext, useContext } from "react";

import type {
  SiteWorkspaceLoadState,
  SiteWorkspaceValue,
} from "@/types/site-workspace";
export const SiteWorkspaceContext = createContext<SiteWorkspaceValue | null>(
  null
);
export function useSiteWorkspace() {
  return useContext(SiteWorkspaceContext);
}

/** Whether blog.json and the drafts failed to load, available even when the workspace never became ready. */
export const SiteWorkspaceLoadContext = createContext<SiteWorkspaceLoadState>({
  failed: false,
  retrying: false,
  retry: () => {},
});
export function useSiteWorkspaceLoad() {
  return useContext(SiteWorkspaceLoadContext);
}
