import {
  DEFAULT_AXIOM_AI_DATASET,
  DEFAULT_AXIOM_GEO_DATASET,
} from "@notra/ai/constants/evlog";
import type { EvlogGlobal, EvlogRuntimeState } from "@notra/ai/types/evlog";
import { createAxiomPipeline } from "@notra/ai/utils/axiom-pipeline";

function createDatasetDrain(dataset: string | undefined) {
  if (!process.env.AXIOM_TOKEN || !dataset) {
    return undefined;
  }
  return createAxiomPipeline({
    apiKey: process.env.AXIOM_TOKEN,
    dataset,
    orgId: process.env.AXIOM_ORG_ID,
  });
}

export function getEvlogRuntime(): EvlogRuntimeState {
  const host = globalThis as EvlogGlobal;
  host.__notraEvlogRuntime ??= {
    aiDrain: createDatasetDrain(
      process.env.AXIOM_AI_DATASET || DEFAULT_AXIOM_AI_DATASET
    ),
    geoDrain: createDatasetDrain(
      process.env.AXIOM_GEO_DATASET || DEFAULT_AXIOM_GEO_DATASET
    ),
  };
  return host.__notraEvlogRuntime;
}
