/** One renewal at a time, with no unhandled timer promises or late renewals. */
export async function withHeartbeat<T>(
  renew: () => Promise<boolean>,
  operation: () => Promise<T>,
  intervalMs: number
): Promise<T> {
  if (!(await renew())) {
    throw new Error("Autopilot lease was lost before starting");
  }
  let alive = true;
  let pending: Promise<void> | null = null;
  const timer = setInterval(() => {
    if (!alive || pending) {
      return;
    }
    pending = renew()
      .then((renewed) => {
        alive = renewed;
      })
      .catch(() => {
        alive = false;
      })
      .finally(() => {
        pending = null;
      });
  }, intervalMs);
  let result: T;
  try {
    result = await operation();
  } finally {
    clearInterval(timer);
    await pending;
  }
  // A transient heartbeat error is not proof the completed operation lost ownership.
  if (!alive && !(await renew())) {
    throw new Error("Autopilot lease was lost while working");
  }
  return result;
}
