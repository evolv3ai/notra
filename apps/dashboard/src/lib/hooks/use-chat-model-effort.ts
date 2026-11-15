"use client";

import {
  AVAILABLE_MODELS,
  ZDR_AVAILABLE_MODELS,
} from "@/constants/chat-models";
import { useHasZdrEntitlement } from "@/lib/hooks/use-plan";
import { useStoredChatPreferences } from "@/lib/hooks/use-stored-chat-preferences";
import type { ChatModelEffortMenuProps } from "@/types/components/chat-input";

/** Model and effort picker state shared by every agent sidebar composer. */
export function useChatModelEffort(): Omit<
  ChatModelEffortMenuProps,
  "disabled"
> {
  const { canUseNonZdr } = useHasZdrEntitlement();
  const availableModels = canUseNonZdr
    ? AVAILABLE_MODELS
    : ZDR_AVAILABLE_MODELS;
  const { preferences, update } = useStoredChatPreferences();

  return {
    availableModels,
    model: availableModels.some((option) => option.id === preferences.model)
      ? preferences.model
      : "auto",
    onModelChange: (model) => update({ model }),
    onThinkingLevelChange: (thinkingLevel) => update({ thinkingLevel }),
    thinkingLevel: preferences.thinkingLevel,
  };
}
