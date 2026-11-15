# AI traffic ingestion

Hono HTTP service on Bun for `POST /api/geo/ingest`, hosted on Unkey Compute.
Hono handles routing and HTTP responses. The Effect processing pipeline lives
in `packages/geo-core/src/ingest` and is also used by the dashboard's
compatibility handler. `Effect.runPromise` is the boundary between Hono and
the pipeline; typed failures are mapped to HTTP responses via `Effect.result`.

## Responsibilities

- This service verifies tracking tokens, classifies visitors, checks project
  hosts and token revocation, applies the existing Redis rate limit, resolves
  journeys, and writes tracked events to Tinybird.
- The dashboard still owns projects, settings, token issuance and rotation,
  installation snippets, and traffic queries.
- Both use the same Postgres, Redis, Tinybird workspace and signing secret.
  Shared Redis keys preserve cache invalidation and the per-organization limit
  across replicas.

Tracked events receive `202` once queued in the bounded in-memory batcher, or
after Tinybird accepts a direct write when the batcher is full. Dropped
traffic also receives `202`. The batcher retries transient write failures; queued
events are not durable across a forced process exit. Analytics run in the
background. SIGTERM stops accepting requests and waits for active requests,
background work and the batcher before closing the database pool and exiting.
Rate-limit hits return `429`; Redis transport failures and limiter timeouts return
`502` without writing an event. Redis availability is required for tracked ingestion.
Token generation is still checked against Postgres and fails closed on an outage.
An identity lookup failure returns `502`; missing identities and revoked tokens
return `401`. Rejection logs retain `reason: invalid_token` and add `authReason`
to distinguish an invalid signature, missing identity, revoked token, inactive
site, or a site token used for a drain. Lookup failures include `stage` as
`identity_lookup` or `site_lookup`. Signed organization/project/site IDs are
included when available; raw tokens and scope from invalid signatures are never
logged.

Before identity and host lookups, tracked AI envelopes and malformed signed payloads
pass a separate 1,000-request-per-minute admission limit keyed by organization,
project and token generation. Token rotation gets a fresh admission budget, and
revoked tokens cannot consume the existing organization-wide accepted-traffic quota.
Human/unknown traffic keeps its zero-I/O drop path.

The worker disables pg's default 10-second idle connection eviction. Sparse AI
traffic therefore reuses connections instead of paying a new TLS/database
handshake after every idle gap. The existing pool maximum (10 connections per
replica), 10-second acquisition timeout and idle-client error handler are
unchanged. No keepalive queries run; a connection dropped by the database is
removed by pg and recreated on demand. Dashboard/API pool defaults are unchanged.

## Local development

From the repository root:

```sh
bun install
bun run dev --filter=ai-traffic-ingest
bun run --filter=ai-traffic-ingest test
bun run --filter=ai-traffic-ingest check-types
```

The root dev command loads the root `.env`. The default local port is `3101`.
See the environment table below for the service-specific variables.

## Unkey Compute configuration

Create a Compute app connected to `usenotra/notra`, branch `main`. This is
application hosting, not Unkey API-key management. Configure its production
environment manually; this repository does not provision it or change DNS.

| Setting | Value |
| --- | --- |
| Build root / context | `.` (repository root, not the app directory) |
| Dockerfile | `apps/ai-traffic-ingest/Dockerfile` |
| Container port | `3000` (`PORT=3000`) |
| Protocol | `http1` |
| Readiness probe | `GET /readyz` |
| Replicas | 2 in the same region, near the existing Postgres and Upstash |
| Start command | Keep the image CMD: `bun dist/index.js` |

Use the existing Dockerfile and its pinned Bun 1.4.4 image. It builds shared
workspace packages from the root and needs no build-time credentials or database
migration. Do not replace its CMD with a development server.

Set the required runtime variables below using the operator's secret-management
workflow. Never put them in build arguments, source, logs, or a deployment root
key. Unkey injects `UNKEY_DEPLOYMENT_ID`, `UNKEY_INSTANCE_ID`, and `UNKEY_REGION`;
do not invent or manually set these IDs. Runtime detection uses the deployment
ID and logs the injected region and instance ID when available.

Leave gateway authentication policies unset: ingestion bearer tokens are Notra
tracking tokens, not Unkey API keys. With no policy, the gateway is passthrough;
do not add an Unkey API-key policy. The gateway documentation specifies no body-size
cap; keep the service's existing per-route limits (including larger drain batches),
rather than adding a new gateway cap. Never log Authorization headers or request
bodies at the gateway or service.

### Termination prerequisite

Before sending production traffic, verify Unkey Compute's actual SIGTERM delivery
and termination grace for this app with an isolated test deployment. Shutdown
allows 35 seconds for active/background work, then stops the three independent
batchers concurrently with a 12-second deadline each, then allows 2 seconds to
close Postgres and 10 seconds to flush logs: a nominal 59-second budget plus
runtime overhead. Confirm adequate host grace and test replacement/shutdown under load.
Deadlines do not make queued events durable; forced termination or failed writes
can lose buffered events. Do not cut over if the host's grace is inadequate.

### Safe local container checks

From the repository root, without a real `.env` or credentials:

```sh
docker build -f apps/ai-traffic-ingest/Dockerfile -t notra-ai-traffic-ingest .
docker run --rm -d --name notra-ingest-check -p 127.0.0.1:3101:3000 notra-ai-traffic-ingest
curl -i http://127.0.0.1:3101/healthz
curl -i http://127.0.0.1:3101/readyz
curl -i -X POST http://127.0.0.1:3101/api/geo/ingest
docker stop --time 70 notra-ingest-check
```

Expect liveness `200`, readiness `503`, and ingestion `503` with missing
configuration. The worker tests use synthetic localhost-only dependency URLs
to verify configured readiness and token rejection without contacting production.

## Set up a new Unkey Compute app

1. Create and **initially deploy the Unkey app manually**, before enabling
   scheduled domain discovery.
   A new app without a verified domain and current deployment cannot pass CI's
   preflight. Auto deploy may remain enabled during this setup.
2. First test a dedicated Unkey origin with isolated test Postgres, Redis,
   Tinybird, and a test signer/token. Verify `/healthz`, `/readyz`, real tracked
   requests, drain routes, rate limiting, Tinybird arrival, and telemetry. Test
   shutdown and the host-grace prerequisite above. Readiness alone is not proof
   that dependencies or credentials work. Do not use customer traffic as a test.
3. Have the operator set the existing shared production runtime configuration,
   including the exact dashboard signing secret. Add `ingest.usenotra.com` to
   the ingest app's production environment and follow Unkey's domain verification
   and DNS instructions. Switch the stable domain only after origin validation;
   check HTTPS, route forwarding, token handling, and ingestion after the switch.
4. Audit `GEO_INGEST_URL` in dashboard and public API environments. Prefer
   `https://ingest.usenotra.com`, not a provider-specific origin, and redeploy
   those apps if changed. Existing dashboard routes proxy to that configured
   origin. The SDK already defaults to `https://ingest.usenotra.com`, so moving
   that stable domain requires no customer configuration or token rotation.
   Explicit provider-specific client endpoints still need a separate audit.
5. After the initial deployment and domain verification, scheduled releases use
   the existing `UNKEY_DEPLOY_ROOT_KEY`
   repository secret used for API deployments; no second key secret is needed.
   Grant that key read access to all four Unkey apps, production environments, domains and
   deployments, plus deployment-create access for all targets. Runtime API-key
   management keys are unrelated; environment-variable read/write grants are not
   needed. Run **Production deploy** with `dry_run` checked. Only after a successful
   dry-run and when scheduled releases are ready, disable production **Auto deploy**
   for ingest, preserving the GitHub connection, and verify a manual real workflow
   run. No additional release flags are needed: the shared key enables API,
   ingest and both demo apps. A permission failure or other Unkey error fails
   the release. Without the shared key, ingest is not released.
   See [CONTRIBUTING.md](../../CONTRIBUTING.md).

Manual Unkey deployments remain available if scheduled ingest releases are not
enabled. Do not disable the current deployment trigger before its replacement
is ready.

Removing `GEO_INGEST_URL` is a rollback: it restores the dashboard's
local compatibility handler but does not redirect SDK clients using the stable
ingest domain. Use the legacy fallback procedure below only when that is intended.

## Docker image

The Docker image contains only Bun and the built bundle. No Next.js server,
build-time credentials, or database migration is required. Build locally with:

```sh
docker build -f apps/ai-traffic-ingest/Dockerfile -t notra-ai-traffic-ingest .
```

## Environment variables

For production, copy these values from the existing dashboard configuration into
the service. Use isolated equivalents for origin testing, never production data:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Existing Notra Postgres database |
| `UPSTASH_REDIS_REST_URL` | Existing Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Existing Redis credentials |
| `TINYBIRD_TOKEN` | Existing token with ingestion permissions |
| `GEO_INGEST_SECRET` | The exact signing secret used by the dashboard |
| `AUTUMN_SECRET_KEY` | Existing billing key; meters and limits `ai_traffic_events`. Without it, events are accepted unmetered and a warning is logged |
| `TINYBIRD_BASE_URL` | Optional existing Tinybird endpoint, especially for a non-default region |

`TINYBIRD_URL` remains a supported alias for the Tinybird base URL.
Optional telemetry variables are `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`,
`NEXT_PUBLIC_POSTHOG_HOST`, `AXIOM_TOKEN`, and `AXIOM_ORG_ID`. Logs go to the
`notra-geo-scan` dataset by default; set `AXIOM_GEO_DATASET` only to override it.
Set `PORT=3000` on the host to match the configured public target port.

Without required configuration, the process starts but rejects ingestion with
`503`. `GET /healthz` checks process liveness and returns `200`.
`GET /readyz` returns `503` until all required values are present, then `200`.
Readiness checks configuration only, not external connectivity or credential
validity. Check a real AI request and its appearance in the dashboard before
switching production traffic.

## Point the dashboard at the service

1. Add the shared credentials to the service, redeploy, and verify `/readyz`.
2. Send an AI request through a site with a valid project token and confirm
   that Tinybird and the dashboard receive it.
3. Set `GEO_INGEST_URL` to the service's public HTTPS origin in the dashboard
   and public API environments, then redeploy those apps.
4. New setup snippets point directly to the service. The dashboard uses Nitro
   `routeRules` proxies to forward existing `/api/geo/ingest` and drain
   installs to the service without invoking its local handler or asking
   customers to rotate tokens.

The SDK's default origin is `https://ingest.usenotra.com`. Verify that this host
serves `/api/geo/ingest` with the shared credentials before publishing an SDK
release that uses it. Self-hosted SDK installations must configure `endpoint`
explicitly; they do not inherit the dashboard's `GEO_INGEST_URL`.

Leave `GEO_INGEST_URL` unset until the service is ready. The existing dashboard
endpoint continues using the shared pipeline locally.

### Dashboard fallback (legacy)

1. Unset `GEO_INGEST_URL` and redeploy the dashboard and API. This restores the
   dashboard's local handler and makes newly generated snippets use its origin.
2. Sites using the SDK default or an explicit dedicated-service URL must set
   `endpoint: "https://app.usenotra.com"` and redeploy. Use the deployment's
   dashboard origin for self-hosted installations.
3. Verify a tracked request reaches Tinybird through the dashboard handler.

Removing `GEO_INGEST_URL` only changes dashboard routing and generated snippets.
It does not redirect requests sent to `ingest.usenotra.com` or another dedicated
origin. The SDK has no automatic dashboard fallback. Direct clients continue
using the dedicated service until their endpoint is changed and redeployed.

## Monitoring in Axiom

The standalone worker also emits `geo.ingest.runtime` once per minute with
process RSS, JS heap and external memory (bytes), active requests, background
tasks, buffered events, and total/idle/waiting database connections. Use these
counters to distinguish retained process memory from growing queues; RSS alone
does not establish a JS memory leak. Unkey instance and deployment IDs separate
processes and restarts. These events contain no
request payloads.

```kusto
['notra-geo-scan'] | where event == 'geo.ingest.runtime'
| summarize rss = max(todouble(rssBytes)), heap = max(todouble(heapUsedBytes)),
    pending = max(todouble(pendingTasks)), buffered = max(todouble(bufferedEvents))
    by bin(_time, 1m), tostring(replicaId), tostring(deploymentId)
```

Every ingest request, on Unkey and the dashboard fallback, emits one
`geo.ingest` event to the `notra-geo-scan` dataset with `outcome`
(`ingested`, `dropped`, `rejected`, `failed`), `reason`, `status`,
`durationMs`, `ingestMs` (Tinybird write), `visitorType`, `source`, `agent`,
`organizationId`, `projectId`, `runtime` (`unkey`, `vercel`, `local`),
`region` and `weight`. Dropped human traffic is sampled at 5%, so always count
with `sum(weight)` instead of `count()`.

```kusto
// Requests per second
['notra-geo-scan'] | where event == 'geo.ingest'
| summarize rps = sum(todouble(weight)) / 60 by bin(_time, 1m), tostring(runtime)

// Ingested events per second, by AI source
['notra-geo-scan'] | where event == 'geo.ingest' and outcome == 'ingested'
| summarize eps = count() / 60.0 by bin(_time, 1m), tostring(source)

// Totals by outcome and reason
['notra-geo-scan'] | where event == 'geo.ingest'
| summarize requests = sum(todouble(weight)) by tostring(outcome), tostring(reason)

// Latency and Tinybird write time
['notra-geo-scan'] | where event == 'geo.ingest' and outcome == 'ingested'
| summarize p50 = percentile(durationMs, 50), p95 = percentile(durationMs, 95),
    p99 = percentile(durationMs, 99), tinybird_p95 = percentile(ingestMs, 95)
    by bin_auto(_time)

// Error rate and top failure messages
['notra-geo-scan'] | where event == 'geo.ingest' and outcome == 'failed'
| summarize failures = count() by tostring(reason), tostring(errorMessage)

// Top organizations by ingested events
['notra-geo-scan'] | where event == 'geo.ingest' and outcome == 'ingested'
| summarize events = count() by tostring(organizationId) | top 20 by events
```
