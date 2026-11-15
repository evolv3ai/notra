# Isolated Dashboard Sites prerequisites

## Reproducible CI-safe smoke run

With Bun, Node and a running Docker daemon, run from the repository root:

```sh
bun --no-env-file install --frozen-lockfile
bun --no-env-file run sites:e2e:dashboard --report ./artifacts/dashboard.json
bun --no-env-file run sites:e2e:dashboard --database-regressions --report ./artifacts/lifecycle.json
```

This command allocates its own random-port PostgreSQL 16 and Redis 7 containers,
migrates and seeds the database, starts the local Redis REST adapter and
Dashboard, checks the session and guarded HTTP endpoint, and removes its owned
services in `finally`. It constructs a selected environment without loading a
project `.env` or inheriting provider credentials. The report labels fixture
authentication and flags, records measured duration and cleanup separately, and
explicitly sets `cloudPublishTested`, `githubOAuthTested` and
`workosLoginTested` to false. It is a Dashboard/security smoke run, not a complete
provider publish or UI journey.

The `--database-regressions` mode also runs the thirteen suites in
`constants/database-regressions.ts`, sequentially against its own loopback
PostgreSQL database on port 55447. The fixed port is required by the existing
destructive-suite guards; an occupied port fails allocation rather than using an
existing database (checked before Docker publishes it, because Docker Desktop
and OrbStack can publish over a host listener). Every listed suite must exit
successfully with no skipped tests. Per-suite duration, test counts and failed
test names are in the JSON report; sanitized logs go to `logs/` next to it.

The database suites cover tenant/project foreign keys, GitHub installation
consent, concurrent capacity admission, advisory locks, deployment generations,
job leases/retries, draft revision and publication races, smart-deployment
fingerprints, production projections, host reclamation and site/project/org
teardown. Their provider boundaries remain controlled adapters.

The connected lifecycle runs the deployment publisher and Sites request handler
against the real database. It exercises site creation and invalid
tenant/duplicate-host rejection, production serving, failed compilation retaining
the live version, duplicate delivery, retry/redeploy, rollback, protected
preview/share access, settings reconciliation, preview removal/disable,
suspend/resume, a post preview whose unpublished file is built as an overlay
without touching production, stale-build fencing, the Databuddy integration
flow (save → draft → pull request that leaves main alone → direct publish
refused until enabled → commit → signed push webhook, with a bad signature
rejected and a duplicate delivery ignored → build held by the rollback pin →
promote → tracker tag and CSP on the live site), the stored build log and Box
telemetry, and namespace-safe deletion.

Every external provider is an emulator from
[`apps/sites-e2e/emulators`](../../apps/sites-e2e/emulators/README.md), reached
through the overrides in `packages/sites-server/src/utils/provider-urls.ts`:
R2 over its S3 API, the Upstash Box API (the guest build runs locally),
Cloudflare for SaaS custom hostnames, the Vercel DNS integration and a UDP DNS
server, which share one DNS zone so a custom domain is verified end to end.
GitHub is [vercel-labs/emulate](https://github.com/vercel-labs/emulate),
seeded with the Acme fixture repository and a GitHub App installation
(`apps/sites-e2e/emulators/github`). The product code runs unchanged against it
via `GITHUB_API_URL`: App JWT, scoped installation tokens (emulate enforces their
permissions), branch heads, tarball downloads, check runs on every built commit,
pull requests, commits and signed push webhooks, which reach the same Sites
handler and secret as the dashboard's webhook route. Every deploy after site
creation is triggered by a real push delivery. A small proxy adds what emulate
does not serve (tarball download, GraphQL `createCommitOnBranch`, branch rules
and the full commit in single-branch responses), built on emulate's own Git data
API so writes stay in its state and fire its webhooks. Only AI name moderation
is stubbed (the AI Gateway's evaluation protocol is proprietary). The test
fails when any emulator saw a request no route handles. The handler
cache is reset between requests so these
checks prove reconciled state, not edge-cache propagation. Retry time is
advanced by making the owned database job due, not by testing a hosted cron
dispatcher.

### Real Upstash Box builds

Add `--box` to build every lifecycle deployment in a real Upstash Box:

```sh
UPSTASH_BOX_API_KEY=… bun --no-env-file run sites:e2e:dashboard \
  --database-regressions --box --report ./artifacts/lifecycle.json
```

The runner first removes `notra-sites-e2e-lifecycle-*` snapshots older than two
hours (left by cancelled runs), then builds a snapshot from this checkout's
toolchain with `apps/sites-builder/scripts/create-box-snapshot.ts`, so the
production `runSandboxBuild` path (upload, guest compile, result/log read,
download, Box deletion) runs against exactly this commit's builder. Only the
lifecycle suite receives the key and snapshot ID. The test asserts every
build came from that snapshot and toolchain version and that the client
reported every Box deleted (the Box emulator additionally checks its own
record of created and deleted boxes after every step); the snapshot itself is deleted by exact ID in `finally`. The Box API
deletes every snapshot on the account when no ID is given, and the account holds
production snapshots, so the helper refuses anything but one validated ID.
Without `--box` the same Box client talks to the Box emulator, which stages
the same toolchain and runs the guest build in a local directory.

The Sites E2E GitHub workflow gates every production release.
`production-deploy.yml` selects the green release commit, calls the workflow
with it and only deploys when it passes; a failure blocks the release and posts
to Slack (`GEO_SCAN_ALERT_WEBHOOK_URL`, the same incoming webhook as GEO alerts;
`SLACK_DEPLOY_WEBHOOK_URL` remains a fallback). GitHub Actions needs its own
repository-secret copy of the URL; it cannot read a sensitive Vercel variable. The
`skip_sites_e2e` dispatch input deploys without the gate for emergencies.
The suite runs only there (and when started by hand with `gh workflow run
sites-e2e.yml --ref <branch>`), not on pull requests or a timer. The workflow
runs this command with `--box` plus the credential guard tests, the
three-repetition browser suite with its cleanup checks, and, alongside but
never blocking the release, the vendors' real analytics scripts
(`--vendor-scripts live`), which alert Slack on failure. Locally, without
`--box`, the lifecycle uses the Box emulator. Reports and the synthetic screenshot are
kept as seven-day artifacts. Real R2/Worker publishing stays in the separate
opt-in `scripts/testing/cloud` lane.

### Reading a run

Each job's summary page renders its report (`apps/sites-e2e/scripts/summary.ts`):
pass/fail/skip counts and failed test names per PostgreSQL suite, every
lifecycle step with its duration and builds (a failure names the step and its
assertion; a timeout names the step it stopped in), each build attempt with
its Box sandbox ID and first error, and the browser checks, timings and the
last check before a failure. The artifact holds the JSON reports, the redacted
log of every suite, the Dashboard and Redis logs (`logs/`) and, for a failed
browser run, `failure.png`. A failed suite also prints its last 60 lines in
the job log, and the one-line failure reasons go to the Slack alert.

## Individual lifecycle commands

These CLIs only accept `SITES_TEST_ENABLED=true` and
`SITES_TEST_DATABASE_URL=postgresql://...@127.0.0.1:<explicit-port>/notra_server_audit`
without URL query parameters. They never use a fallback `DATABASE_URL`. Always
use `bun --no-env-file`; do not load a real project `.env`.

Verify failed Docker allocation cleanup with:

```sh
bun --no-env-file scripts/testing/dashboard/tests/postgres-cleanup.ts
```

It occupies one owned random port, attempts a second allocation on that port,
and verifies the failed allocation is removed while the first stays running.
The first container and its volume are removed in `finally`.

From the repository root:

```sh
export SITES_TEST_ENABLED=true
bun --no-env-file scripts/testing/dashboard/postgres.ts up
```

Save the returned container name and export its returned URL as
`SITES_TEST_DATABASE_URL`. The CLI creates a uniquely named, labelled Postgres 16
container on a Docker-allocated loopback port. The password in that returned URL
is a fixed synthetic test password, not a real credential.

```sh
bun --no-env-file scripts/testing/dashboard/migrate.ts
bun --no-env-file scripts/testing/dashboard/fixtures.ts seed
```

Migration uses the committed Drizzle journal, including `0000_baseline`, on the
fresh database. Do not use schema export or `db:push` as a substitute. Seed is
repeatable and replaces only the `sites-e2e-acme` and `sites-e2e-other` fixture
organizations and their two users. Each tenant has a member, brand settings, and
project. Acme has a site attached to its project; the outsider is a member only
of the other tenant. No GitHub installation, deployment, domain, or cloud state
is fabricated.

For a real GitHub publisher run with local fixture authentication, bootstrap the
pinned owner's GitHub connection from an already authenticated CLI. The token
is stored encrypted, so generate a synthetic test key first; the Dashboard
launch command below passes the same key so it can read the token:

```sh
export SITES_TEST_INTEGRATION_ENCRYPTION_KEY="$(openssl rand -base64 32)"
INTEGRATION_ENCRYPTION_KEY="$SITES_TEST_INTEGRATION_ENCRYPTION_KEY" \
  bun --no-env-file scripts/testing/dashboard/bootstrap-github-cli.ts <github-user>/notra-sites-e2e-<nonce>
bun --no-env-file scripts/testing/dashboard/tests/github-bootstrap-guard.ts
```

The bootstrap verifies the CLI identity and administration of the explicitly
named private disposable repository, then stores its existing access token,
encrypted with that synthetic key, only in the isolated test database. Fixture cleanup removes that credential row.
This is an authenticated CLI credential fixture, not a WorkOS or GitHub OAuth
login test. It does not create a GitHub App installation or grant repository
consent. Continue through the Dashboard's normal GitHub install-state and
callback flow, selecting only the disposable repository.

The Dashboard's Upstash client can use a local SDK-compatible REST adapter over
an actual isolated Redis container. Create a container named
`notra-dashboard-redis-e2e-<lowercase-uuid>` with label
`notra.dashboard-redis-e2e=isolated-test`, publishing `6379/tcp` exclusively to a
Docker-allocated port on `127.0.0.1`. With a generated local token of at least 32
characters, run:

```sh
SITES_TEST_REDIS_CONTAINER=<owned-container> \
SITES_TEST_REDIS_REST_TOKEN=<local-test-token> \
  bun --no-env-file scripts/testing/dashboard/redis-rest.ts
SITES_TEST_ENABLED=true bun --no-env-file test scripts/testing/dashboard/tests/redis-rest.test.ts
```

Its readiness JSON supplies the origin for `UPSTASH_REDIS_REST_URL`; supply the
same token as `UPSTASH_REDIS_REST_TOKEN`. The adapter derives its Redis URL from
the ownership-checked Docker mapping and refuses forwarded/public requests.
It executes real Redis commands and Lua, removing only Upstash's unsupported
`allow-key-locking` Lua shebang directive. This is transport emulation, not
evidence of Upstash vendor reception. Stop the adapter and remove only its
label-verified container and volume when the run ends.

For local workflow execution, set `WORKFLOW_TARGET_WORLD=local`,
`WORKFLOW_LOCAL_BASE_URL` to the loopback Dashboard origin and
`WORKFLOW_LOCAL_DATA_DIR` to the run's private scratch directory. This exercises
the Workflow SDK locally; its in-memory queue does not establish Vercel-hosted
durability across server restarts.

To attach a genuinely approved repository, first register its real GitHub App
installation and repository selection for organization `sites-e2e-acme` through
the GitHub integration setup, then run:

```sh
bun --no-env-file scripts/testing/dashboard/associate-repository.ts <integration-row-id>
```

This CLI uses the existing `requireOrganizationRepository` authorization check;
the installation/integration must already exist, belong to Acme, and be enabled
with repository access selected. It updates only site `sites-e2e-acme-site` in
project `sites-e2e-acme-project`, copying `repositoryId`, `githubInstallationId`
(the numeric GitHub installation ID, not its database row ID),
`githubRepositoryId`, `repositoryOwner`, `repositoryName`, and `productionBranch`
from that approved record. It never creates an installation or fakes approval.
The seeded site's `publicOrigin=https://acme.example.test`, mounts `/blog` and
`/changelog`, and lack of a provisioned host record are synthetic. Real serving
tests should create a site through the product API so host ownership and public
origin are provisioned normally; association alone does not provision hosting.

Run the Dashboard with a clean environment, not a copy of staging credentials:

```sh
cd apps/dashboard
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=development \
  NODE_OPTIONS=--max-old-space-size=6144 \
  DATABASE_URL="$SITES_TEST_DATABASE_URL" SITES_TEST_ENABLED=true \
  INTEGRATION_ENCRYPTION_KEY="$SITES_TEST_INTEGRATION_ENCRYPTION_KEY" \
  DEV_AUTH_ENABLED=true DEV_AUTH_EMAIL=sites-e2e-owner@example.test \
  APP_URL=http://127.0.0.1:33173 \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:33173 \
  NEXT_PUBLIC_SITE_URL=http://127.0.0.1:33173 \
  WORKOS_API_KEY=placeholder WORKOS_CLIENT_ID=placeholder \
  WORKOS_COOKIE_PASSWORD=synthetic-only-test-cookie-password-32 \
  WORKOS_REDIRECT_URI=http://127.0.0.1:33173/auth/callback \
  bun --no-env-file x vite --host 127.0.0.1 --port 33173
```

The existing local-dev auth path requires development, explicit opt-in, a
loopback request, and no live WorkOS key. It is not usable for remote staging.
The synthetic placeholder values above are intentional; real WorkOS testing
needs a separately registered callback and actual user authentication.

From the repository root, check the running server:

```sh
bun --no-env-file scripts/testing/dashboard/verify.ts http://127.0.0.1:33173
```

`GET /__tests/sites` is JSON-only, read-only, and returns only the authenticated
active organization's site identifiers after a membership check. It is hidden
with 404 in production, when disabled, for a nonloopback/forwarded request, or
when the app uses a different database. Vite can reject a public Host header
itself with 403 before application routing. There is no reset or seeding API.

Cloud creation/deployment also needs the separately configured GitHub,
Box and R2 services. A successful status check is not a full UI E2E pass.

`sitesRuntimeConfigured` uses the actual Sites runtime readiness check. Its
required variables are `SITES_R2_ACCOUNT_ID`, `SITES_R2_ACCESS_KEY_ID`,
`SITES_R2_SECRET_ACCESS_KEY`, `SITES_R2_BUCKET`, `SITES_HOSTING_DOMAIN`,
`SITES_PREVIEW_SECRET`, `SITES_BUILDER_SNAPSHOT_ID`, and `UPSTASH_BOX_API_KEY`.
Without them the browser shows the genuine “Sites isn't available here” state.
Do not fill in fake keys just to pass this check; the list/detail flow
subsequently reads real serving state from R2.

Use the repository's declared Node 24 runtime where available. The explicit
test-only heap budget above avoids the default V8 heap-limit failure observed
on this device's Node 26.11.1 during concurrent dev/build work. Do not run a
production build and Vite dev against the same worktree simultaneously.

For real database regressions:

```sh
bun --no-env-file test packages/sites-server/tests/postgres-lifecycle.test.ts \
  packages/sites-server/tests/smart-deployments-postgres.test.ts
```

The existing draft-CAS PostgreSQL wrapper additionally hard-codes port `55447`,
so it rejects Docker-allocated ports. If that port is free, `postgres.ts up 55447`
creates a separate, uniquely named test container bound there. Migrate it and
use its returned URL for the draft-CAS suite, then remove that exact container.
Do not use or remove an existing service on that port.

Stop the dev server before cleanup, then run:

```sh
bun --no-env-file scripts/testing/dashboard/fixtures.ts cleanup
bun --no-env-file scripts/testing/dashboard/postgres.ts down <returned-container-name>
```

Cleanup deletes only fixture-owned database records. Container removal checks
both the generated name prefix and ownership label and removes its anonymous
volume. Each CLI prints `durationMs` measured with a monotonic clock. Keep all
these commands in a `finally`/shell trap in the E2E orchestrator, including on
failure. Never use a global Docker prune or remove unrelated containers.
