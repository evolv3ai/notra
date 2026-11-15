import type { LogFlushScheduler } from "@notra/ai/types/operational-log";

export function createLogFlushScheduler(
  schedule: LogFlushScheduler
): LogFlushScheduler {
  let active = Promise.resolve();
  let scheduled = false;

  return (flush) => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    const preceding = active;
    const run = async () => {
      await preceding;
      scheduled = false;
      const current = flush();
      active = current.catch(() => {});
      await current;
    };
    try {
      schedule(run);
    } catch {
      setTimeout(() => {
        run().catch(() => {});
      }, 0);
    }
  };
}
