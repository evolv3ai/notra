"use client";

import { useEffect, useState } from "react";

import {
  CLAUDE_SEARCH_QUERY_MS,
  CLAUDE_SEARCH_RESULTS_MS,
  CLAUDE_SEARCH_STEP_MS,
  CLAUDE_SEARCH_VERB_HOLD_MS,
} from "../constants/claude";

interface ClaudeSearchSequence {
  done: boolean;
  visibleCount: number;
}

export const useClaudeSearchSequence = (
  toolFlags: string,
  enabled: boolean
): ClaudeSearchSequence => {
  const [sequence, setSequence] = useState<ClaudeSearchSequence>({
    done: false,
    visibleCount: 0,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const flags = toolFlags ? toolFlags.split(",") : [];
    const timers: number[] = [];
    let elapsed = CLAUDE_SEARCH_VERB_HOLD_MS;

    for (const [index, isTool] of flags.entries()) {
      timers.push(
        window.setTimeout(() => {
          setSequence((current) => ({ ...current, visibleCount: index + 1 }));
        }, elapsed)
      );
      elapsed +=
        isTool === "true"
          ? CLAUDE_SEARCH_QUERY_MS + CLAUDE_SEARCH_RESULTS_MS
          : CLAUDE_SEARCH_STEP_MS;
    }
    timers.push(
      window.setTimeout(() => {
        setSequence((current) => ({ ...current, done: true }));
      }, elapsed)
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      setSequence({ done: false, visibleCount: 0 });
    };
  }, [enabled, toolFlags]);

  return sequence;
};
