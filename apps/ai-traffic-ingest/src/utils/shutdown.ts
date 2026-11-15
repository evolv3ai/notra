export async function withDeadline(
  task: () => Promise<void>,
  timeoutMs: number
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task().then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error("[geo-ingest] Shutdown step failed", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function stopIngestBatchers(
  stops: (() => Promise<void>)[],
  timeoutMs: number
): Promise<boolean[]> {
  return Promise.all(stops.map((stop) => withDeadline(stop, timeoutMs)));
}
