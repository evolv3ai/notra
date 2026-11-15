import { startAstroDev, stopAstroDev } from "../dev-server";
import type { DevAreaServer, RunningDevArea } from "../types/dev-server";

export async function startDevAreas(
  toolchainRoot: string,
  areas: DevAreaServer[]
): Promise<RunningDevArea[] | null> {
  const results = await Promise.allSettled(
    areas.map((area) => startAstroDev(toolchainRoot, area))
  );
  const running = results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure || running.length !== areas.length) {
    await Promise.all(running.map(stopAstroDev));
    if (failure) {
      throw failure.reason;
    }
    return null;
  }
  return running;
}
