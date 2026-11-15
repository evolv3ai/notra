import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

export function runWithGeoRequestMemo<T>(fn: () => T): T {
  return storage.run(new Map(), fn);
}

export function memoizeGeoRequest<T>(
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const memo = storage.getStore();
  if (!memo) {
    return load();
  }

  const cached = memo.get(key) as Promise<T> | undefined;
  if (cached) {
    return cached;
  }

  const pending = load();
  memo.set(key, pending);
  pending.catch(() => memo.delete(key));
  return pending;
}
