import { EngineIcon } from "@notra/ui/components/geo/engine-icon";

import type { StateOfAiSearchEngine } from "@/types/state-of-ai-search";

export function EngineLabel({ engine }: { engine: StateOfAiSearchEngine }) {
  return (
    <span className="flex items-center gap-2.5">
      <EngineIcon engine={engine.model} />
      {engine.label}
    </span>
  );
}
