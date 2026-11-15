import {
  MEMORY_ON_DEMAND_LIMIT_BYTES,
  MEMORY_PRELOADED_HARD_LIMIT_BYTES,
  MEMORY_PRELOADED_PATTERN,
  MEMORY_PRELOADED_SOFT_LIMIT_BYTES,
  MEMORY_SAFE_PATH,
} from "../constants/memory";
import type { MemoryActor, MemoryChanges } from "../types/memory";
import { MemoryAccessError, MemoryLimitError } from "./errors";

const WRITABLE: Record<MemoryActor, (path: string) => boolean> = {
  "autopilot-run": (path) => path === "planner.md",
  user: (path) =>
    path === "rules.md" || path === "feedback.md" || path === "planner.md",
  knowledge: (path) => path.startsWith("knowledge/"),
};

export function isPreloadedPath(path: string) {
  return MEMORY_PRELOADED_PATTERN.test(path);
}

export function byteLength(content: string) {
  return new TextEncoder().encode(content).length;
}

/** Refuses writes outside the actor's paths and files past their hard limit. */
export function assertWritable(actor: MemoryActor, changes: MemoryChanges) {
  for (const [path, content] of Object.entries(changes)) {
    if (!(MEMORY_SAFE_PATH.test(path) && !path.includes(".."))) {
      throw new MemoryAccessError(`Not a memory path: ${path}`);
    }
    if (!WRITABLE[actor](path)) {
      throw new MemoryAccessError(`${actor} may not write ${path}`);
    }
    if (content === null) {
      continue;
    }
    const limit = isPreloadedPath(path)
      ? MEMORY_PRELOADED_HARD_LIMIT_BYTES
      : MEMORY_ON_DEMAND_LIMIT_BYTES;
    const size = byteLength(content);
    if (size > limit) {
      throw new MemoryLimitError(
        `${path} is ${size} bytes, over its ${limit} byte limit: compact it first`
      );
    }
  }
}

export function overSoftLimit(changes: MemoryChanges) {
  return Object.entries(changes).flatMap(([path, content]) =>
    content !== null &&
    isPreloadedPath(path) &&
    byteLength(content) > MEMORY_PRELOADED_SOFT_LIMIT_BYTES
      ? [path]
      : []
  );
}
