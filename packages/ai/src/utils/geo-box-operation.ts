export async function awaitGeoBoxOperation<T>(
  operation: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) {
    return operation;
  }
  const reason = () =>
    signal.reason instanceof Error
      ? signal.reason
      : new Error("Box operation was cancelled");
  if (signal.aborted) {
    void operation.catch(() => undefined);
    throw reason();
  }
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(reason());
  });
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([operation, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
