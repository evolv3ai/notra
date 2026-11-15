import { flushGeoLog, geoLog } from "@notra/ai/evlog";
import { logError } from "@notra/ai/utils/server-log";
import { GEO_TRAFFIC_FLUSH_INTERVAL_MS } from "@notra/analytics/constants/cache";
import {
  ingestWebPageEngagement,
  ingestWebPageViews,
} from "@notra/analytics/tinybird/client";
import { db } from "@notra/db/drizzle";
import { retainDatabaseConnections } from "@notra/db/utils/retain-database-connections";
import { GEO_DRAIN_MAX_BODY_BYTES } from "@notra/geo-core/constants/ingest";
import {
  createEventBatcher,
  createGeoEventBatcher,
} from "@notra/geo-core/ingest/batcher";
import { announceGeoTrafficRows } from "@notra/geo-core/ingest/live";
import {
  getGeoIngestRegion,
  getGeoIngestRuntime,
} from "@notra/geo-core/utils/ingest-runtime";

import {
  INGEST_DEFAULT_PORT,
  INGEST_DATABASE_CLOSE_TIMEOUT_MS,
  INGEST_DRAIN_TIMEOUT_MS,
  INGEST_EVENTS_FLUSH_TIMEOUT_MS,
  INGEST_FLUSH_TIMEOUT_MS,
  INGEST_RUNTIME_LOG_INTERVAL_MS,
} from "./constants/server";
import { createIngestApp } from "./http";
import { missingIngestEnvironment } from "./utils/config";
import { stopIngestBatchers, withDeadline } from "./utils/shutdown";

const pending = new Set<Promise<void>>();
const active = new Set<Promise<Response>>();
const missing = missingIngestEnvironment();
if (missing.length > 0) {
  console.warn(`[geo-ingest] Missing configuration: ${missing.join(", ")}`);
}

const databasePool = process.env.DATABASE_URL ? db.$client : null;
if (databasePool) {
  retainDatabaseConnections(databasePool);
}

const batcher = createGeoEventBatcher({
  intervalMs: GEO_TRAFFIC_FLUSH_INTERVAL_MS,
  onWritten: announceGeoTrafficRows,
});
const webBatcher = createEventBatcher({
  intervalMs: GEO_TRAFFIC_FLUSH_INTERVAL_MS,
  write: ingestWebPageViews,
});
const engagementBatcher = createEventBatcher({
  intervalMs: GEO_TRAFFIC_FLUSH_INTERVAL_MS,
  write: ingestWebPageEngagement,
});

const app = createIngestApp(
  (task) => {
    const promise = task()
      .catch((error) => {
        logError("[geo-ingest] Background task failed", error);
      })
      .finally(() => pending.delete(promise));
    pending.add(promise);
  },
  {
    enqueue: batcher.enqueue,
    expedite: (organizationId) => {
      batcher.expedite(organizationId);
      webBatcher.expedite(organizationId);
    },
    enqueueWeb: webBatcher.enqueue,
    enqueueEngagement: engagementBatcher.enqueue,
  }
);

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: process.env.PORT ?? INGEST_DEFAULT_PORT,
  maxRequestBodySize: GEO_DRAIN_MAX_BODY_BYTES,
  idleTimeout: 60,
  fetch(request) {
    const response = Promise.resolve(app.fetch(request));
    active.add(response);
    return response.finally(() => active.delete(response));
  },
});

console.info(`[geo-ingest] Listening on port ${server.port}`);

const runtimeLogTimer = setInterval(() => {
  const memory = process.memoryUsage();
  geoLog.info({
    event: "geo.ingest.runtime",
    runtime: getGeoIngestRuntime(),
    region: getGeoIngestRegion(),
    replicaId: process.env.UNKEY_INSTANCE_ID,
    deploymentId: process.env.UNKEY_DEPLOYMENT_ID,
    uptimeSeconds: Math.round(process.uptime()),
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    externalBytes: memory.external,
    activeRequests: active.size,
    pendingTasks: pending.size,
    bufferedEvents: batcher.size(),
    webBufferedEvents: webBatcher.size(),
    engagementBufferedEvents: engagementBatcher.size(),
    databaseConnections: databasePool?.totalCount ?? 0,
    databaseIdleConnections: databasePool?.idleCount ?? 0,
    databaseWaitingRequests: databasePool?.waitingCount ?? 0,
  });
}, INGEST_RUNTIME_LOG_INTERVAL_MS);
runtimeLogTimer.unref();

async function drain() {
  const stopped = server.stop();
  await Promise.allSettled(active);
  await stopped;
  await Promise.allSettled(pending);
}

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearInterval(runtimeLogTimer);
  if (!(await withDeadline(drain, INGEST_DRAIN_TIMEOUT_MS))) {
    console.error(
      `[geo-ingest] Drain exceeded ${INGEST_DRAIN_TIMEOUT_MS}ms, closing connections`
    );
    server.stop(true);
  }
  const [webFlushed, engagementFlushed, flushed] = await stopIngestBatchers(
    [
      () => webBatcher.stop(),
      () => engagementBatcher.stop(),
      () => batcher.stop(),
    ],
    INGEST_EVENTS_FLUSH_TIMEOUT_MS
  );
  if (!flushed || batcher.size() > 0) {
    console.error(
      `[geo-ingest] Buffered events not written before exit (${batcher.size()} left in buffer)`
    );
  }
  const webLeft = webBatcher.size();
  const engagementLeft = engagementBatcher.size();
  if (!webFlushed || !engagementFlushed || webLeft > 0 || engagementLeft > 0) {
    console.error(
      `[geo-ingest] Web events not written before exit (${webLeft} page views, ${engagementLeft} engagement events left in buffer)`
    );
  }
  if (
    databasePool &&
    !(await withDeadline(
      () => databasePool.end(),
      INGEST_DATABASE_CLOSE_TIMEOUT_MS
    ))
  ) {
    console.error(
      `[geo-ingest] Database pool did not close within ${INGEST_DATABASE_CLOSE_TIMEOUT_MS}ms`
    );
  }
  if (!(await withDeadline(flushGeoLog, INGEST_FLUSH_TIMEOUT_MS))) {
    console.error(
      `[geo-ingest] Log flush did not finish within ${INGEST_FLUSH_TIMEOUT_MS}ms`
    );
  }
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
