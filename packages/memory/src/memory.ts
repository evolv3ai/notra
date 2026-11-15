import { setTimeout as sleep } from "node:timers/promises";

import {
  MEMORY_COMMIT_ATTEMPTS,
  MEMORY_CONFLICT_BACKOFF_MS,
} from "./constants/memory";
import { createCodeStorageStore } from "./stores/code-storage";
import type {
  MemoryActor,
  MemoryChanges,
  MemorySnapshot,
  MemoryStore,
  MemoryUpdateResult,
} from "./types/memory";
import { assertWritable, overSoftLimit } from "./utils/access";
import { MemoryConflictError, MemoryNotConfiguredError } from "./utils/errors";

let configured: MemoryStore | null = null;
let override: MemoryStore | null = null;

/** The workspace memory store; code.storage unless a test swapped it. */
export function getMemoryStore(): MemoryStore {
  if (override) {
    return override;
  }
  if (configured) {
    return configured;
  }
  const name = process.env.CODE_STORAGE_NAME?.trim();
  const key = process.env.CODE_STORAGE_API_KEY?.trim().replace(/\\n/g, "\n");
  if (!(name && key)) {
    throw new MemoryNotConfiguredError(
      "CODE_STORAGE_NAME and CODE_STORAGE_API_KEY are required for workspace memory"
    );
  }
  configured = createCodeStorageStore({ name, key });
  return configured;
}

/** Tests and evals run against an in-memory store. null restores code.storage. */
export function setMemoryStore(store: MemoryStore | null) {
  override = store;
}

export async function openMemorySnapshot(
  organizationId: string,
  store: MemoryStore = getMemoryStore()
): Promise<MemorySnapshot> {
  const sha = await store.head(organizationId);
  const cache = new Map<string, Promise<string | null>>();
  return {
    sha,
    read(path) {
      if (!sha) {
        return Promise.resolve(null);
      }
      let pending = cache.get(path);
      if (!pending) {
        pending = store.read(organizationId, path, sha);
        cache.set(path, pending);
      }
      return pending;
    },
    list: () => (sha ? store.list(organizationId, sha) : Promise.resolve([])),
  };
}

async function alreadyApplied(
  store: MemoryStore,
  organizationId: string,
  changes: MemoryChanges
) {
  const head = await store.head(organizationId);
  if (!head) {
    return null;
  }
  for (const [path, content] of Object.entries(changes)) {
    if ((await store.read(organizationId, path, head)) !== content) {
      return null;
    }
  }
  return head;
}

/**
 * Reads the memory, lets `mutate` derive changes from that exact version and
 * commits them only if nobody wrote in between. On a conflict it re-reads and
 * re-applies, so concurrent writers never lose each other's updates. After a
 * failed request it checks whether the commit landed anyway before retrying.
 */
export async function updateMemory(params: {
  organizationId: string;
  actor: MemoryActor;
  message: string;
  author?: { name: string; email: string };
  mutate: (snapshot: MemorySnapshot) => Promise<MemoryChanges | null>;
  store?: MemoryStore;
}): Promise<MemoryUpdateResult> {
  const store = params.store ?? getMemoryStore();
  let lastConflict: unknown = null;
  for (let attempt = 0; attempt < MEMORY_COMMIT_ATTEMPTS; attempt += 1) {
    const snapshot = await openMemorySnapshot(params.organizationId, store);
    const proposed = await params.mutate(snapshot);
    const changes: MemoryChanges = {};
    for (const [path, content] of Object.entries(proposed ?? {})) {
      if ((await snapshot.read(path)) !== content) {
        changes[path] = content;
      }
    }
    if (Object.keys(changes).length === 0) {
      return { sha: snapshot.sha, changed: false, overSoftLimit: [] };
    }
    assertWritable(params.actor, changes);
    try {
      const sha = await store.commit(params.organizationId, {
        expectedHeadSha: snapshot.sha,
        message: params.message,
        files: changes,
        author: params.author,
      });
      return { sha, changed: true, overSoftLimit: overSoftLimit(changes) };
    } catch (error) {
      if (error instanceof MemoryConflictError) {
        lastConflict = error;
        await sleep(Math.random() * MEMORY_CONFLICT_BACKOFF_MS * (attempt + 1));
        continue;
      }
      const landed = await alreadyApplied(
        store,
        params.organizationId,
        changes
      ).catch(() => null);
      if (landed) {
        return {
          sha: landed,
          changed: true,
          overSoftLimit: overSoftLimit(changes),
        };
      }
      throw error;
    }
  }
  throw lastConflict ?? new MemoryConflictError("Memory kept changing");
}

/** Idempotent: a workspace without memory is already deleted. */
export function deleteMemory(
  organizationId: string,
  options: { signal?: AbortSignal; store?: MemoryStore } = {}
) {
  return (options.store ?? getMemoryStore()).deleteRepo(
    organizationId,
    options.signal
  );
}
