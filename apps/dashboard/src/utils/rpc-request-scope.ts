import { AsyncLocalStorage } from "node:async_hooks";

import type { ORPCRequestMemo } from "@/types/orpc/context";

const storage = new AsyncLocalStorage<ORPCRequestMemo>();

export function runWithRpcRequestMemo<T>(
  memo: ORPCRequestMemo,
  operation: () => T
): T {
  return storage.run(memo, operation);
}

export function getRpcRequestMemo(): ORPCRequestMemo | undefined {
  return storage.getStore();
}
