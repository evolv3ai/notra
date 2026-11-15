"use client";

import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { useCallback, useEffect, useRef, useState } from "react";

import { COMMAND_ROUTES } from "@/constants/command-palette";
import { COMMAND_PALETTE_AI_ERROR_ACTION } from "@/constants/studio-analytics";
import { trackEvent } from "@/lib/analytics/posthog-client";
import type {
  AiResult,
  CommandPaletteAiState,
  UseCommandPaletteAiParams,
} from "@/types/components/command-palette";

async function requestCommandPaletteAi(
  query: string,
  slug: string,
  projectId: string | null,
  signal: AbortSignal
): Promise<AiResult | "aborted" | "error"> {
  try {
    const response = await fetch("/api/command-palette/navigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, slug, projectId: projectId ?? undefined }),
      signal,
    });
    if (signal.aborted) {
      return "aborted";
    }
    if (!response.ok) {
      return "error";
    }
    return (await response.json()) as AiResult;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return "aborted";
    }
    return "error";
  }
}

/**
 * ⌘↵ in the palette: asks the navigate route (Jev, then LLM) where the query
 * belongs and opens that page, the settings modal or the chat.
 */
export function useCommandPaletteAi({
  query,
  slug,
  projectId,
  close,
  openSettings,
  pushPath,
}: UseCommandPaletteAiParams) {
  const [aiState, setAiState] = useState<CommandPaletteAiState>({
    status: "idle",
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const resetAi = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAiState({ status: "idle" });
  }, []);

  const navigateFromAi = (
    path: string,
    labelKey: "opening" | "openingChat"
  ) => {
    setAiState({ status: "navigating", labelKey });
    pushPath(path);
    close();
  };

  const runAiSearch = async () => {
    const trimmed = query.trim();
    if (!(trimmed && slug)) {
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiState({ status: "loading" });
    const startedAt = Date.now();
    const result = await requestCommandPaletteAi(
      trimmed,
      slug,
      projectId,
      controller.signal
    );
    if (result === "aborted") {
      return;
    }
    if (result === "error") {
      trackEvent(POSTHOG_EVENTS.COMMAND_PALETTE_AI_NAVIGATE, {
        action: COMMAND_PALETTE_AI_ERROR_ACTION,
        latency_ms: Date.now() - startedAt,
        query_length: trimmed.length,
      });
      setAiState({ status: "error" });
      return;
    }
    trackEvent(POSTHOG_EVENTS.COMMAND_PALETTE_AI_NAVIGATE, {
      action: result.action,
      latency_ms: Date.now() - startedAt,
      query_length: trimmed.length,
    });
    if (result.action === "navigate" && result.path) {
      const settingsRoute = COMMAND_ROUTES.find(
        (route) => route.settingsSection && route.path(slug) === result.path
      );
      if (settingsRoute?.settingsSection) {
        close();
        openSettings(settingsRoute.settingsSection);
        return;
      }
      navigateFromAi(result.path, "opening");
      return;
    }
    if (result.action === "chat") {
      const qs = trimmed ? `?q=${encodeURIComponent(trimmed)}` : "";
      navigateFromAi(`/${slug}/chat${qs}`, "openingChat");
      return;
    }
    setAiState({ status: "error" });
  };

  return { aiState, runAiSearch, resetAi };
}
