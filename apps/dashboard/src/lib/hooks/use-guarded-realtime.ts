"use client";

import type { RealtimeEvent, RealtimeSchema } from "@notra/ai/realtime";
import {
  GEO_LIVE_MAX_FAILED_CONNECTS,
  GEO_LIVE_PAUSE_AFTER_FAILURES_MS,
} from "@notra/geo-core/constants/geo";
import { useRealtime, type UseRealtimeOpts } from "@upstash/realtime/client";
import { useEffect, useState } from "react";

/**
 * `useRealtime` that steps back after repeated failed connects.
 * `@upstash/realtime` 1.x resets its retry counter inside every reconnect, so
 * `maxReconnectAttempts` never trips and a failing /api/realtime (expired
 * session, outage) is retried every second for as long as the tab is open.
 * Dropping the subscription for a while is the one thing that stops its loop.
 */
export function useGuardedRealtime<const E extends RealtimeEvent>(
  options: UseRealtimeOpts<RealtimeSchema, E>
) {
  const [failedConnects, setFailedConnects] = useState(0);
  const paused = failedConnects >= GEO_LIVE_MAX_FAILED_CONNECTS;
  const { status } = useRealtime<RealtimeSchema, E>({
    ...options,
    enabled: (options.enabled ?? true) && !paused,
  });

  const [previousStatus, setPreviousStatus] = useState(status);
  if (status !== previousStatus) {
    setPreviousStatus(status);
    if (status === "connected") {
      setFailedConnects(0);
    } else if (previousStatus === "connecting" && status !== "connecting") {
      setFailedConnects((count) => count + 1);
    }
  }

  useEffect(() => {
    if (!paused) {
      return;
    }
    const resume = setTimeout(
      () => setFailedConnects(0),
      GEO_LIVE_PAUSE_AFTER_FAILURES_MS
    );
    return () => clearTimeout(resume);
  }, [paused]);

  return status;
}
