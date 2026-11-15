import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import type { GeoPersonaSnapshot } from "@notra/db/types/geo-personas";

import { GEO_SEQUENCE_MAX_TURNS } from "../constants/geo";
import { GEO_OLOSTEP_PERSONA_INTRO_MAX_CHARS } from "../constants/geo-olostep";
import type {
  GeoOlostepPlanItems,
  GeoOlostepQuery,
  GeoOlostepResults,
} from "../types/geo-olostep";
import { isGeoOlostepEngine } from "./geo-olostep";

/**
 * Every scraped prompt is a fresh chat, so a follow-up repeats the questions
 * asked before it in the conversation.
 */
function geoOlostepFollowUpQuery(
  earlier: readonly string[],
  prompt: string
): string {
  if (earlier.length === 0) {
    return prompt;
  }
  const asked = earlier.map((question) => `- ${question}`).join("\n");
  return `Earlier I asked:\n${asked}\n\n${prompt}`;
}

/**
 * A logged-out app has no memory of the persona, so each persona prompt opens
 * with who is asking.
 */
export function geoOlostepPersonaQuery(
  snapshot: GeoPersonaSnapshot,
  prompt: string
): string {
  const { persona, memories } = snapshot;
  const intro = [
    `I'm a ${persona.role} at ${persona.company}.`,
    persona.summary,
    persona.profile.currentStack.length > 0
      ? `We currently use ${persona.profile.currentStack.join(", ")}.`
      : "",
    ...memories.map((memory) => memory.content),
  ]
    .filter(Boolean)
    .join(" ");
  const clipped = Array.from(intro)
    .slice(0, GEO_OLOSTEP_PERSONA_INTRO_MAX_CHARS)
    .join("");
  return `${clipped}\n\n${prompt}`;
}

/**
 * Every prompt an Olostep engine answers in a scan, in a fixed order: tracked
 * prompts, sequence steps, then persona prompts. `applyGeoOlostepResults`
 * walks the plan in the same order.
 */
export function buildGeoOlostepQueries(
  plan: GeoOlostepPlanItems
): GeoOlostepQuery[] {
  const tasks = plan.tasks
    .filter((task) => isGeoOlostepEngine(task.engine))
    .map((task) => ({
      engine: task.engine,
      language: task.language,
      text: task.prompt.text,
    }));
  const steps = plan.sequences
    .filter((sequence) => isGeoOlostepEngine(sequence.engine))
    .flatMap((sequence) =>
      sequence.steps
        .slice(0, GEO_SEQUENCE_MAX_TURNS)
        .map((step, index, steps) => ({
          engine: sequence.engine,
          language: sequence.language ?? DEFAULT_LANGUAGE,
          text: geoOlostepFollowUpQuery(steps.slice(0, index), step),
        }))
    );
  const personaPrompts = plan.personas
    .filter((persona) => isGeoOlostepEngine(persona.engine))
    .flatMap((persona) =>
      persona.prompts.map((prompt, index, prompts) => ({
        engine: persona.engine,
        language: DEFAULT_LANGUAGE,
        text: geoOlostepPersonaQuery(
          persona.snapshot,
          geoOlostepFollowUpQuery(prompts.slice(0, index), prompt)
        ),
      }))
    );
  return [...tasks, ...steps, ...personaPrompts];
}

/** Attaches result handles to the plan in `buildGeoOlostepQueries` order. */
export function applyGeoOlostepResults(
  plan: GeoOlostepPlanItems,
  results: GeoOlostepResults
): GeoOlostepPlanItems {
  let index = 0;
  const next = (): string | null => {
    const id = results[String(index)] ?? null;
    index += 1;
    return id;
  };
  return {
    tasks: plan.tasks.map((task) =>
      isGeoOlostepEngine(task.engine)
        ? { ...task, olostepRetrieveId: next() ?? undefined }
        : task
    ),
    sequences: plan.sequences.map((sequence) =>
      isGeoOlostepEngine(sequence.engine)
        ? {
            ...sequence,
            olostepRetrieveIds: sequence.steps
              .slice(0, GEO_SEQUENCE_MAX_TURNS)
              .map(next),
          }
        : sequence
    ),
    personas: plan.personas.map((persona) =>
      isGeoOlostepEngine(persona.engine)
        ? { ...persona, olostepRetrieveIds: persona.prompts.map(next) }
        : persona
    ),
  };
}
