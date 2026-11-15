"use client";

import { useState } from "react";

import { COMMAND_PALETTE_RECENTS_LIMIT } from "@/constants/command-palette";
import { localStorageKeys } from "@/constants/storage";
import type { CommandPaletteRecent } from "@/types/components/command-palette";

function recentKey(recent: CommandPaletteRecent): string {
  return recent.kind === "route" ? `route:${recent.id}` : recent.key;
}

function readRecents(organizationId: string): CommandPaletteRecent[] {
  if (!organizationId) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(
      localStorageKeys.commandPaletteRecents(organizationId)
    );
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? (parsed as CommandPaletteRecent[]).slice(
          0,
          COMMAND_PALETTE_RECENTS_LIMIT
        )
      : [];
  } catch {
    return [];
  }
}

/** Last picked palette results per workspace, newest first. */
export function useCommandPaletteRecents(organizationId: string) {
  const [state, setState] = useState(() => ({
    organizationId,
    recents: readRecents(organizationId),
  }));
  let { recents } = state;
  if (state.organizationId !== organizationId) {
    recents = readRecents(organizationId);
    setState({ organizationId, recents });
  }

  const addRecent = (recent: CommandPaletteRecent) => {
    const key = recentKey(recent);
    const next = [
      recent,
      ...recents.filter((item) => recentKey(item) !== key),
    ].slice(0, COMMAND_PALETTE_RECENTS_LIMIT);
    setState({ organizationId, recents: next });
    try {
      window.localStorage.setItem(
        localStorageKeys.commandPaletteRecents(organizationId),
        JSON.stringify(next)
      );
    } catch {
      // Recents are a convenience; a full or blocked storage is fine.
    }
  };

  return { recents, addRecent };
}
