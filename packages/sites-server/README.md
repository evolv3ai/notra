# Notra Sites: server side and runbook

Hosted blogs and changelogs built from a customer GitHub repository.

For the current gated, defaults-first rollout and Cloudflare prerequisites, see
[the private-beta release checklist](PRIVATE_BETA.md).

| Piece | Where | Runs on |
| --- | --- | --- |
| Shared contract (schemas, mounts, hosts, state transitions, preview tokens) | `packages/sites-core` | everywhere |
| MDX/JSX validator + transform (never executes customer code) | `packages/sites-compiler` | dashboard + sandbox |
| Build toolchain (Astro theme, `notra-sites` CLI) | `apps/sites-builder` | Upstash Box snapshot |
| Orchestration (outbox, builds, activation, domains, editor) | `packages/sites-server` | dashboard (Vercel Workflow) |
| Static file server | `apps/sites` | Cloudflare Worker |

## Flow

```
GitHub App webhook (push / pull_request / check_run)
  → apps/dashboard/src/app/api/webhooks/github/app (signature, durable delivery claim in site_webhook_deliveries)
  → site_deployments + site_jobs in one transaction (generation allocated under a row lock)
  → siteJobWorkflow → runSiteJob (lease + attempts on the job row)
  → GitHub tarball at the exact SHA → Upstash Box from snapshot, network deny-all, no secrets
  → out.tgz → validated (regular files only, limits) → R2 deployments/{site}/{deployment}/files/**
  → manifest.json written last
  → state.json compare-and-swap (ETag): pointer only moves to a higher generation
  → GitHub check run (annotations on failure) + updated PR preview comment

Visitor → sites worker → hosts/{host}.json → sites/{site}/state.json (re-read every ≤5 s, fail closed)
  → manifest (immutable, cached per isolate) → file from R2 (edge cache keyed by deployment)
```

The cron `/api/cron/sites` (every minute) re-dispatches jobs whose dispatch was lost or whose lease expired. `/api/cron/sites-cleanup` (daily) deletes deployments that are neither live, an open preview, still building, nor in the last 10 production releases.

## Production rollbacks

Owners and admins can roll back to any of the last ten successful production
builds. Rollback switches the serving pointer without changing Git commits or
starting another build. The serving state records `productionRollback: true`;
subsequent builds still finish and appear in the deployment history, but cannot
replace the live build. Smart-deployment skipping is disabled for pinned
production so it cannot advance the rollback baseline. Previews remain independent.

Both **Promote** on the newest successful build and **Undo rollback** on the live
build select the newest successful production build at execution time and resume
automatic publishing. Failed, skipped and preview builds do not count toward the
ten-build window. A build must still have its stored manifest and match the
current domain, mounts and branding configuration; incompatible builds require
a redeploy instead.

Production pointers retain the source `buildGeneration` separately from the
monotonic switch `generation`. A newer build already running when promotion
happens can still become live when it finishes; an older build finishing late
cannot overwrite it. Switch generations remain reserved outside the storage
transaction so a database retry cannot reuse a generation already published to R2.

If concurrent activations exhaust their bounded generation-reservation pass,
activation fails transiently so the build job retries instead of completing an
unpublished newer build. Completed builds retry finalization independently of
the construction attempt budget and do not reserve sandbox build capacity.
An already-served build is an idempotent activation:
retries repair the SQL production projection without moving the R2 switch fence
or clearing a rollback. Repeating an already-applied rollback also repairs that
projection, including when the pinned build has fallen outside the history window.
Held successful builds report **Automatic publishing paused** in GitHub checks,
separately from genuinely superseded builds. Promotion refreshes the selected
build's check to **Live** after the production switch commits.

Rollback eligibility and artifact retention use the same ten-build history.
Cleanup additionally protects the currently live build, even if newer builds
push it outside that window, all active previews, in-progress builds and builds
within the existing 24-hour settlement period. It expires removed deployments
instead of deleting the history and diagnostic telemetry. Older serving-state
objects without `productionRollback` default to automatic publishing.

## R2 layout (private bucket)

```
hosts/{hostname}.json                       { siteId, kind: alias|custom }, created with If-None-Match
sites/{siteId}/state.json                   status, production pointer, previews; CAS on ETag
deployments/{siteId}/{deploymentId}/manifest.json
deployments/{siteId}/{deploymentId}/files/{mount}/...
logs/{siteId}/{deploymentId}.log
```

## Build metrics and retained logs

The telemetry table is included in the consolidated `0112_sites` migration.
Apply that migration for a fresh rollout. Do not replay it on a database that
already applied an earlier local Sites migration sequence; reconcile that
database's migration history separately.
Builds upsert structured metrics and final logs into `site_build_telemetry`, keyed
by deployment ID, after sandbox cleanup and when the pipeline finishes. Compiler
failures and source/provider/publication exceptions also retain partial metrics
and error logs. Live logs continue to use R2. The authorized deployment GET
returns `metrics`; terminal deployments prefer the database log, while running
deployments prefer the live log and fall back to the database copy. Older
deployments without a telemetry row still use their existing R2 logs.

Normal artifact cleanup and deployment expiry do not remove this telemetry.
There is no application-level expiration. Explicit deployment, site, or
organization deletion removes its telemetry through the deployment foreign key's
cascade, preserving the existing deletion policy.

Logs preserve the leading deployment phase markers and newest valid UTF-8 output
within the existing **512-KiB cap**. They are bounded final logs, not unlimited
console history or an archive of every retry. Known provider/repository secrets,
authorization values and URL credentials are redacted before persistence. Logs
are not included in metrics JSON or deployment list responses. Database write
failures are not silently treated as successful persistence: an already failing
pipeline preserves its original exception and records the persistence error in
its best-effort R2 log.

Sandbox HTTP rejections retain a redacted provider error response and, when
available, an `x-request-id` or `x-upstash-request-id`. Diagnostic reads are
limited to 4 KiB and 2 seconds. Oversized bodies are omitted rather than partially
logged, so truncation cannot expose part of a credential. Unreadable bodies retain
the HTTP status and a safe placeholder, including rejections near the request
deadline. `sites.job_failed` also logs the site/deployment IDs,
attempt count, sandbox operation, status, and provider diagnostics. The enriched
error message is retained by the existing job, build-log, and telemetry paths.

`metrics.version` is 1. `phases` contains monotonic millisecond durations for
attempted repository access, source download, sandbox startup, upload, execution, result reads,
output download, cleanup and publication. Guest extraction, compilation and
packing phases are nested within execution; do not sum all phase values to
derive total time. Compiler area durations are recorded separately.

Final `totalDurationMs` covers repository access through publication/cleanup and
host orchestration, excluding the final telemetry write and later activation/
GitHub reporting. Existing `buildDurationMs` keeps its earlier dashboard meaning:
sandbox startup through result reading, before output download and cleanup.

`sandboxCpuTimeMs` is the cgroup CPU delta during guest extraction/build/packing,
not whole-lifecycle billing or child-process CPU time. `sandboxMemoryPeakBytes`
is the cgroup lifetime high-water mark, not aggregate child-process RSS. Both are
null when the platform does not expose the counters. No costs are invented from
missing provider meters. `requestedSize` records configuration, not hardware
verification.

For example, compile duration can be aggregated without reading log blobs:

```sql
SELECT
  count(*) AS measured_builds,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY (metrics #>> '{phases,compile}')::double precision
  ) AS median_compile_ms
FROM site_build_telemetry
WHERE metrics #>> '{phases,compile}' IS NOT NULL;
```

## Runbook

**Take a site down now (abuse, legal).** Dashboard → site → Settings → Take site offline, or:
`setSiteSuspended(site, true, reason)`. The worker serves 410 within 5 s for every path, cached files included. New builds for the site are refused.

**Bad release.** Deployments tab → Restore an earlier deployment (no rebuild, takes a fresh generation so running builds cannot override it). Only deployments built for the current origin + mounts are offered.

**Builds stuck in `queued`.** Check `site_jobs` for the deployment: `pending` with `dispatched_at` set → the sweep re-dispatches after 2 minutes; `running` with an expired `lease_until` → the sweep re-claims it; `failed` → `last_error`, attempts exhausted (redeploy from the dashboard). Concurrency limits (`SITE_BUILD_LIMITS`) push jobs back by 20 s when the sandbox budget is used up.

**What the builder snapshot is.** Every site build runs in a fresh Upstash Box started from `SITES_BUILDER_SNAPSHOT_ID`: a saved Box with the toolchain (Astro, theme, compiler, `node_modules`) already installed. That is what keeps builds at about 12 s and lets them run with the network denied, so customer code cannot fetch or send anything. Without the variable every build fails. The snapshot belongs to the Upstash account of the key that created it, so build it with the same `UPSTASH_BOX_API_KEY` the dashboard uses.

**Toolchain change (theme, Astro, compiler, site config schema).** Production is automatic: the release workflow hashes the toolchain, and when it differs from `SITES_BUILDER_TOOLCHAIN_VERSION` it builds a new snapshot, upserts `SITES_BUILDER_SNAPSHOT_ID` + `SITES_BUILDER_TOOLCHAIN_VERSION` on the `notra` Vercel project and redeploys the dashboard. Never ship a site config schema change without it: an old snapshot rejects new settings and every build crashes in `readBuildTarget`. For local or manual rolls:
`cd apps/sites-builder && bun --env-file=../../.env scripts/create-box-snapshot.ts --write-env ../../.env`. The deployment records the toolchain `VERSION`.

**Sites worker release.** The production release script deploys `apps/sites` from the same CI-checked release commit after all production-target and commit-ancestry checks, but before the dashboard rollout. It requires the GitHub repository secret `CLOUDFLARE_API_TOKEN`, scoped to the production account and `notra.site` zone; the account ID is set in the workflow. Dry runs skip the deployment, older releases are rejected before changing the worker, and a failed worker deployment prevents the dashboard rollout. Existing variables and secrets are preserved. Keep manifest schemas backward-compatible because the worker goes live before new site builds and still serves older deployments.

**Reader page actions.** The theme shares `CopyArticle.astro` between blog posts and
standalone changelog entries, using their generated `.md` files. Blog posts show
actions by default; changelog entries require `changelog.pageActions: true`
(default `false`). `blog.json`'s `contextual` setting applies to both areas and can
still hide all actions. AI links pass the title and canonical
Markdown URL in a prefilled prompt; they do not upload the article, bypass preview
access controls or require provider API keys. A theme update requires the snapshot
roll above and a new build of each Site; existing immutable deployments do not change.

**Rotate the preview secret.** Generate a new value, set `SITES_PREVIEW_SECRET` (dashboard) and `PREVIEW_SECRET` (worker: `wrangler secret put PREVIEW_SECRET`) together. Existing preview sessions and share links stop working.

**AI resource discovery.** The worker advertises existing `llms.txt` and
`llms-full.txt` artifacts through `Link` headers on manifest-routed responses,
including HTML and Markdown 404s. `X-Llms-Txt` points to the section's `llms.txt`
(or the root index outside a section). Both files have `/.well-known/` redirect
aliases at the root and section mounts. Missing artifacts are not advertised,
and protected previews still require access before discovery or file serving.
These worker changes do not require a builder snapshot roll or a site rebuild.

**Preview access.** Protected previews open with a Notra login (member session), a share link (7 days) or, if set, the preview password.

- *Member sessions* are signed tokens with `userId` + `issuedAt`, valid 1 h. The host-only cookie lives 7 days so an expired one renews by bouncing through `/sites/preview-access` (no click while the member is signed in). Removing a member, leaving an organization, the WorkOS `organization_membership.deleted` webhook and dashboard sign-out write `revokedSessions[userId]` into `state.json` of every affected site; the worker refuses tokens issued at or before it within 5 s. Losing access also ends the share links that member created; signing out does not. Entries are pruned once every token they cover has expired. Role changes don't matter: every member role may open previews.
- *Password*: the database (`sites.preview_password`) is the source of truth: PBKDF2-SHA256, 100k iterations (the Workers maximum), 16-byte random salt, random `version`, never the password. Every `state.json` write copies it from the database, so a lost or stale state gets it back with the next write; `sites.get` also repairs a mismatch in the background (`syncServingPreviewAccess`). The worker verifies `POST /_notra/auth` and mints a password session carrying `passwordVersion`, so changing or removing the password ends all password sessions within 5 s. Guessing is limited by the `PREVIEW_PASSWORD_LIMITER` rate limit binding (10/min per IP and preview; IPv6 keyed by /64) and `PREVIEW_PASSWORD_SITE_LIMITER` (60/min per site), both per Cloudflare location, on top of the PBKDF2 cost. The session cookie is `__Host-notra_preview` on https so another `*.notra.site` tenant cannot overwrite it for the parent domain.
- *Threat model*: `state.json` is a private R2 object; the worker only serves files below `deployments/*/files/`. Someone with R2 read access gets exactly what a database leak gives: a salted, 100k-iteration PBKDF2 hash per site to attack offline (choose long preview passwords), plus the revocation timestamps. Neither lets them mint sessions: that needs `PREVIEW_SECRET`. The dashboard client only ever sees whether a password is set and when.
- Turning previews off closes all open previews like closed PRs; the next push after turning them on builds again.

**PR preview comments.** Enabled per site by default (`preview_comments_enabled`,
migration `0113_site_preview_comments`). Settings → Previews → Post PR comments
can disable comments independently of builds and GitHub checks. One comment per
PR and site is updated while building and on completion, with the commit, build
details and, only once activated, the normal preview URL. Protected previews
retain their access controls; comments contain no share tokens, passwords or
build logs. Reporting is best effort and cannot fail the build. Updates are
serialized, restricted to comments authored by this GitHub App, and ignored for
superseded deployments, closed PRs, changed heads and disabled previews.

**Customer proxy domain stopped verifying.** `Check` in the Domains tab runs the probe (`{origin}{mount}/_notra/probe.txt` must name the site) and shows the exact failing URL. The site keeps serving; only the canonical origin is affected.

**Restore after data loss.** R2 holds build artifacts and live logs; any deployment can be rebuilt from its commit (Redeploy). The database is the source of truth for sites/domains and retained build telemetry (Neon point-in-time restore). A missing `state.json` makes the worker 404 the site until the next deployment activates.

## Domain Connect (one-click DNS for custom subdomains)

Customers whose DNS provider supports [Domain Connect](https://github.com/Domain-Connect/spec/blob/master/Domain%20Connect%20Spec%20Draft.adoc) (Cloudflare, GoDaddy, IONOS, ...) can let the provider create the subdomain records instead of copying them. Synchronous flow, signed requests only.

- `domains.connect` (oRPC) → `domainConnectForDomain`: TXT `_domainconnect.<zone>` (walking up from the parent of the hostname) → `GET https://<that>/v2/<zone>/settings` → `GET <urlAPI>/v2/domainTemplates/providers/usenotra.com/services/sites` (requires version 2 and all three expected records) → signed apply URL. The application returns `unavailable` for proxy/active domains, `unsupported` when configuration, ownership records, or the complete provider template are missing, and `ready` only for a supported complete setup.
- Template version 2: [`domain-connect/usenotra.com.sites.json`](domain-connect/usenotra.com.sites.json). It configures CNAME `@` → `cname.notra.site`, TXT `_cf-custom-hostname` → `%ownership%` (Cloudflare), and TXT `_notra` → `%notraOwnership%` (Notra's public, site-and-hostname-bound challenge). Both TXT values are included in the signed apply payload. Providers must serve the version-2 template with all three records; older or incomplete templates fall back to manual setup instead of offering a partial automatic configuration. Certificates validate over HTTP once the CNAME resolves; the Notra TXT is still required to prove which tenant owns the hostname.
- Signature: RSA-SHA256 (PKCS#1 v1.5) over the exact query string we send (params sorted, `encodeURIComponent`), then `&key=<keyHost>&sig=<base64, url-encoded>`; `sig` must be last for Cloudflare.
- Callback: the provider redirects to `/sites/domain-connect/<token>` (HMAC with `SITES_PREVIEW_SECRET` under its own label, 2 h, carries site + domain id; in the path because Cloudflare ignores `state`). The route re-runs the domain check and redirects to `/<org>/sites/<site>/domains?domainConnect=success|cancelled|error`.

**One-time setup**

1. Keys: `cd packages/sites-server && bun scripts/domain-connect-keys.ts`. Put the PKCS#8 key into `SITES_DOMAIN_CONNECT_PRIVATE_KEY` (Vercel, dashboard project; the single-line `\n` form works) and publish the printed records as separate TXT records named `_dck1.domainconnect.usenotra.com`. Verify: `bun --env-file=../../.env scripts/domain-connect-keys.ts --check`.
2. Template PR to [Domain-Connect/Templates](https://github.com/Domain-Connect/Templates): submit the version-2 JSON file (filename `usenotra.com.sites.json`, repo root). Before opening it run `dc-template-linter -merge-or-fail`, `-tolerate warn`, `-cloudflare` and `-logos`, test it in the [online editor](https://domainconnect.paulonet.eu/dc/free/templateedit) and link the result in the PR. The PR description must justify the bare `%ownership%` value: Cloudflare for SaaS prescribes the full TXT value (a UUID) and it cannot carry a prefix. The separate `%notraOwnership%` value carries Notra's versioned public challenge. Register this updated template with each provider; this repository change does not publish it or alter live DNS. Until registration is complete, the application requires manual setup. Candidates without their own Cloudflare resource must first configure the displayed Notra TXT and CNAME, then refresh and configure any additional Cloudflare validation records.
3. Cloudflare onboarding (after the PR is merged): email `domain-connect@cloudflare.com` with the GitHub link to the template, the public key domain `_dck1.domainconnect.usenotra.com`, an SVG logo, the proxy preference **DNS only (not proxied)** for the CNAME (the hostname must resolve to our Cloudflare for SaaS zone so HTTP certificate validation works), and optionally a Cloudflare account ID to test with before they publish it.
4. GoDaddy, IONOS and others onboard templates from the same repository on their own schedule; nothing to send. A provider is ready when the support check above returns 2xx.

**Rotate the key.** Generate a new pair with `--key-host _dck2`, publish the new TXT records next to the old ones, then switch `SITES_DOMAIN_CONNECT_PRIVATE_KEY` + `SITES_DOMAIN_CONNECT_KEY_HOST=_dck2`. Remove `_dck1` once no apply link older than a few hours is in flight.

**Changing the CNAME target or records** needs a template version bump, a new PR and (for Cloudflare) waiting for their automation to pick it up (up to 8 h). Until then the code must keep sending the old variables.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `SITES_R2_ACCOUNT_ID`, `SITES_R2_ACCESS_KEY_ID`, `SITES_R2_SECRET_ACCESS_KEY`, `SITES_R2_BUCKET` | dashboard | R2 token scoped to the sites bucket (Object Read & Write) |
| `SITES_HOSTING_DOMAIN` | dashboard + worker (`HOSTING_DOMAIN`) | domain for `{slug}.` aliases and `{preview}--{slug}.` previews |
| `SITES_PREVIEW_SECRET` | dashboard + worker (`PREVIEW_SECRET`) | HMAC for preview tokens |
| `SITES_BUILDER_SNAPSHOT_ID` | dashboard | Upstash Box toolchain snapshot |
| `UPSTASH_BOX_API_KEY` | dashboard | sandbox builds |
| `CLOUDFLARE_SAAS_ZONE_ID`, `CLOUDFLARE_SAAS_API_TOKEN`, `SITES_CNAME_TARGET` | dashboard | custom subdomains (Cloudflare for SaaS) |
| `SITES_DOMAIN_CONNECT_PRIVATE_KEY` (+ optional `SITES_DOMAIN_CONNECT_KEY_HOST` `_dck1`, `SITES_DOMAIN_CONNECT_PROVIDER_ID` `usenotra.com`, `SITES_DOMAIN_CONNECT_SERVICE_ID` `sites`) | dashboard | one-click DNS via Domain Connect; unset = feature off |
| `SITES_HOSTING_PROTOCOL`, `SITES_HOSTING_PORT` | dashboard, local dev only | `http` + `8787` for `wrangler dev` on `*.sites.localhost` |
| GitHub App | | events `push`, `pull_request`, `check_run`; permissions contents write, pull requests write, checks write |

## Local development

```bash
cd apps/sites && npx wrangler dev --env dev        # worker on :8787, real dev bucket
# dashboard with SITES_HOSTING_DOMAIN=sites.localhost SITES_HOSTING_PROTOCOL=http SITES_HOSTING_PORT=8787
open http://{slug}.sites.localhost:8787/blog
cd apps/sites-builder && bun compiler/cli.ts dev --source <site repo>   # theme dev with live reload
```

## Smart deployments (Beta)

`sites.smartDeployments` defaults to `true`, including existing Sites after migration
`0114_site_smart_deployments`. Changing the setting alone does not rebuild the Site.

Automatic push and pull-request deployments compare a complete Git tree against
the fingerprint of the deployment currently referenced by serving state. Preview
keys have separate baselines. The fingerprint includes collected file paths and
Git blob IDs, repository/root identity, the complete build target, draft visibility,
builder snapshot ID and UTC year. Path selection is shared with the compiler.

Identical inputs produce a terminal `skipped` deployment with an explicit reason.
GitHub checks and PR comments show **Skipped – no site changes** and link to the
existing published Site or preview. Canceled and superseded builds remain separate
skip reasons and do not advertise a preview that they did not publish.
The serving pointer retains its deployment ID and files while advancing its
generation, preventing an older concurrent build from replacing the current Site.
The comparison is fenced again under the existing storage lock and R2 CAS before
the skip is persisted. Retries can finish persistence after a serving-state write.

First deployments, manual builds, redeploys, configuration-triggered builds and
unknown comparisons build normally. Truncated trees, missing fingerprints,
unsupported archive transformations (`.gitattributes` / `.lfsconfig`), and source
limits also require a build. Existing published deployments establish their first
fingerprint on their next successful build. The UTC year invalidates equality at
the next deployment check; this does not schedule a yearly deployment.

TypeSafe Jev evaluates the verified comparison alongside the deterministic
policy. Its probability and model ID are recorded in `smartDeploymentEvaluation`.
The model receives comparison facts, not repository contents. Missing credentials,
provider failures or model disagreement cannot override proven input equality or
skip changed inputs. This Beta does not enable autonomous model decisions.

Unchanged automatic deployments do not reserve or consume daily build slots.
Manual/non-smart queued deployments reserve slots at admission; automatic smart
deployments reserve a slot atomically only if a build is necessary. Retries of an
already started deployment do not reserve a second slot.

## Verification

### Required projects (migration 0115)

Sites belong to projects and remain shared with all organization members. A
project with Sites cannot be deleted; remove its Sites explicitly first. Public
URLs, Site IDs, deployments and stored assets are unchanged by this migration.

Before deploying, inventory **all** unassigned Sites in the target database,
including those eligible for automatic backfill:

```sql
SELECT id AS site_id, organization_id
FROM sites
WHERE project_id IS NULL
ORDER BY organization_id, id;
```

Then run this read-only preflight to identify Sites needing explicit assignment:

```sql
SELECT s.id AS site_id, s.organization_id,
       count(p.id) AS non_sample_projects,
       array_agg(p.id ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL) AS candidates
FROM sites s
LEFT JOIN projects p ON p.organization_id = s.organization_id AND NOT p.is_sample
WHERE s.project_id IS NULL
GROUP BY s.id, s.organization_id
HAVING count(p.id) <> 1;
```

The migration runs within Drizzle's migration transaction. It backfills only
unassigned Sites whose organization has exactly one non-sample project. It never
changes an existing assignment. Zero or multiple non-sample projects abort the
entire migration with unresolved Site IDs, organization IDs and candidate counts.
Do not select the first/oldest project or create placeholder projects to proceed.
An operator must choose the intended existing same-organization project (or
create a genuine project via the application) and explicitly assign each Site.
Follow the maintenance sequence below before applying assignments or migration:

```sql
UPDATE sites s
SET project_id = p.id
FROM projects p
WHERE s.id = '<unresolved-site-id>'
  AND s.project_id IS NULL
  AND p.id = '<chosen-project-id>'
  AND p.organization_id = s.organization_id
RETURNING s.id, s.organization_id, s.project_id;
```

Confirm exactly one returned row per assignment, rerun the preflight, then retry
migration 0115 through the normal migration runner. For manual SQL execution wrap
the entire migration in `BEGIN` / `COMMIT`; never run individual statements in
autocommit mode. No R2 cleanup or serving-state changes are required.

**Maintenance sequence: explicit assignment and automatic backfill**

An unassigned Site's ingestion identity falls back to the organization's oldest
project, including sample projects. That cached project can differ from either
the chosen manual assignment or the migration's sole non-sample project.

1. Run the inventory and preflight above. Include every unassigned Site in the
   affected set, not just ambiguous Sites; automatic backfill also changes
   ingestion identity.
2. Before any assignment, quiesce Site analytics ingress for the affected Sites
   on **all active paths and replicas**: the dedicated ingest service and the
   dashboard compatibility handler, including direct and proxied endpoints.
   Use operator-controlled routing or maintenance controls; there is no assumed
   pause environment flag. Drain accepted/in-flight requests, background work
   and queued events before proceeding. Keep public Sites online: do not suspend
   Sites or change R2/serving state. See the
   [AI traffic ingestion runbook](../../apps/ai-traffic-ingest/README.md) for
   routing and graceful drain behavior.
3. Apply required same-organization assignments with the SQL above, confirm one
   returned row each, and rerun the preflight. Run migration 0115 through the
   normal transactional migration runner, including automatic backfill. Preserve
   the transaction requirements above. If assignment, migration or verification
   fails, keep ingress quiesced until corrected.
4. Before resuming, choose **one** cache-clearing approach:
   - Call `invalidateIngestSiteCaches(siteId, organizationId)` from
     `packages/geo-core/src/ingest/sites.ts` for every affected Site in an
     environment configured for the target database and shared Redis. Confirm
     successful deletion of the affected `geo:ingest-site:v2:<siteId>` identity
     and `geo:ingest-organization-sites:v2:<organizationId>` prefix-cache keys.
     Then drain/restart **every ingestion-capable process/replica**, including
     dashboard instances, to clear process memory. Calling the helper in a
     migration runner clears only that runner's local memory; deployment alone
     does not evict shared Redis.
   - Keep ingress quiesced for **at least 6 minutes after the last committed
     assignment or migration**. The active shared identity TTL is 300 seconds
     and process memory lasts 60 seconds; a process can refresh from stale Redis
     just before Redis expiry, so allow the full 360 seconds.
5. While ingress is still quiesced, verify that each affected analytics-enabled
   Site resolves to its database project on every ingestion path/replica. Resume
   only after those checks pass, then smoke-check newly ingested page-view and
   engagement attribution in the assigned project. This procedure does not
   rewrite historical analytics.

Run `bun test tests` in this package. PostgreSQL integration suites additionally
require `SITES_TEST_DATABASE_URL` pointing to the synthetic local database
`postgresql://postgres@127.0.0.1:55447/notra_server_audit`, initialized with the
current schema. They test real queries, serving-state CAS and pipeline decisions
with simulated GitHub, model, sandbox and R2 adapters. Do not use a customer or
production database for these suites.
