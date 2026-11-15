"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";

import { TRAFFIC_PATH_PARAM } from "@/constants/traffic-path";

/** Exact page path the traffic pages are filtered to, empty for every page. */
export function useTrafficPathQuery() {
  return useQueryState(
    TRAFFIC_PATH_PARAM,
    parseAsString.withDefault("").withOptions({ clearOnDefault: true })
  );
}

/**
 * Every path seen so far for `scope` (a site or project), in first-seen order.
 * A filtered response only lists the selected page, so the page keeps the rest
 * pickable. Call it from a component that stays mounted while the filter
 * toggles empty states.
 */
export function useKnownTrafficPaths(
  paths: readonly string[],
  scope: string
): string[] {
  const [state, setState] = useState<{ scope: string; paths: string[] }>({
    scope,
    paths: [],
  });
  const known = state.scope === scope ? state.paths : [];
  const seen = new Set(known);
  const unseen = paths.filter((path) => !seen.has(path));
  if (unseen.length > 0 || state.scope !== scope) {
    const next = [...known, ...new Set(unseen)];
    setState({ scope, paths: next });
    return next;
  }
  return known;
}
