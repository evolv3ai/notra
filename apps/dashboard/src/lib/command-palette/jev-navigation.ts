import { getEvaluationClient } from "@notra/ai/evaluation/client";

import {
  COMMAND_PALETTE_ENTITY_DESCRIPTIONS,
  COMMAND_PALETTE_JEV_CHAT_CHOICE,
  COMMAND_PALETTE_JEV_FEATURE,
  COMMAND_PALETTE_JEV_MIN_CONFIDENCE,
  COMMAND_PALETTE_JEV_TIMEOUT_MS,
} from "@/constants/command-palette";
import type {
  AiResult,
  ResolveNavigationWithJevParams,
} from "@/types/components/command-palette";

/**
 * Picks the palette destination with Jev (~300 ms) as one choice question
 * over the visible routes, the matching workspace entities and a chat option.
 * Returns `null` when Jev is unavailable or unsure so the caller can fall
 * back to the LLM router.
 */
export async function resolveNavigationWithJev({
  query,
  routes,
  entities,
  organizationId,
  abortSignal,
}: ResolveNavigationWithJevParams): Promise<AiResult | null> {
  const paths = new Map<string, string>();
  const criteria: Record<string, string> = {};

  for (const [index, route] of routes.entries()) {
    const choice = `route_${index}`;
    paths.set(choice, route.path);
    criteria[choice] =
      `Open the ${route.label} page (${route.section}). Covers: ${route.keywords.join(", ")}`;
  }
  for (const [index, entity] of entities.entries()) {
    const choice = `entity_${index}`;
    paths.set(choice, entity.path);
    criteria[choice] =
      `Open the ${COMMAND_PALETTE_ENTITY_DESCRIPTIONS[entity.type]} "${entity.label}"`;
  }
  criteria[COMMAND_PALETTE_JEV_CHAT_CHOICE] =
    "No page or item fits: the user asks a question, wants an analysis, or asks Notra to write or change something";

  const result = await getEvaluationClient().tryEvaluate({
    feature: COMMAND_PALETTE_JEV_FEATURE,
    organizationId,
    abortSignal,
    timeoutMs: COMMAND_PALETTE_JEV_TIMEOUT_MS,
    state: { product: "Notra dashboard", query },
    questions: {
      destination: {
        type: "choice",
        instructions:
          "Where in the Notra dashboard should the command palette take the user for query? Prefer a specific item over a general page when the query names it.",
        criteria,
      },
    },
  });
  if (!result) {
    return null;
  }

  const { choice, probabilities } = result.answers.destination;
  const confidence = probabilities?.[choice] ?? result.confidence.destination;
  if (
    confidence === undefined ||
    confidence < COMMAND_PALETTE_JEV_MIN_CONFIDENCE
  ) {
    return null;
  }
  if (choice === COMMAND_PALETTE_JEV_CHAT_CHOICE) {
    return { action: "chat", path: null, reason: "Jev: no page fits." };
  }
  const path = paths.get(choice);
  if (!path) {
    return null;
  }
  return {
    action: "navigate",
    path,
    reason: `Jev picked this with p=${confidence.toFixed(2)}.`,
  };
}
