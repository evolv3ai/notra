"use client";

import type { StoredChatPreferences } from "@notra/ai/types/chat";
import { useMemo, useSyncExternalStore } from "react";

import {
  DEFAULT_CHAT_PREFERENCES,
  readRawStoredChatPreferences,
  readStoredChatPreferences,
  subscribeToStoredChatPreferences,
  writeStoredChatPreferences,
} from "@/utils/chat-preferences";

/**
 * Chat model and thinking level shared by every mounted composer. Updates merge
 * with the latest stored value so one composer never overwrites the other's field.
 */
export function useStoredChatPreferences() {
  const raw = useSyncExternalStore(
    subscribeToStoredChatPreferences,
    readRawStoredChatPreferences,
    () => null
  );
  const preferences = useMemo<StoredChatPreferences>(
    () =>
      raw === null
        ? DEFAULT_CHAT_PREFERENCES
        : (readStoredChatPreferences() ?? DEFAULT_CHAT_PREFERENCES),
    [raw]
  );

  const update = (patch: Partial<StoredChatPreferences>) => {
    writeStoredChatPreferences({
      ...(readStoredChatPreferences() ?? DEFAULT_CHAT_PREFERENCES),
      ...patch,
    });
  };

  return { preferences, update };
}
