# Contributing to Notra

Thanks for wanting to contribute to Notra. This guide shows how to set up locally and what we expect in PRs.

## Tech Stack

Notra is a Bun + Turborepo monorepo.

- Runtime and package manager: **Bun**
- Monorepo orchestration: **Turbo**
- Dashboard: **TanStack Start**, **Vite**, **Nitro**
- Public website: **TanStack Start**, **Vite**, **Nitro**
- Shared frontend: **React 19**, **Tailwind CSS 4**
- API: **Hono** on **Cloudflare Workers**
- Database: **Postgres (Neon or PlanetScale Postgres recommended)** with **Drizzle ORM / drizzle-kit**
- Dashboard auth: **WorkOS AuthKit**
- Queueing and rate limiting: **Upstash (QStash/Redis)**
- API Keys: **Unkey**

## Repository Structure

```text
/
|- apps/
|  |- ai-traffic-ingest/ # Bun collector (Unkey Compute)
|  |- api/         # Hono API (Cloudflare Worker)
|  |- dashboard/   # Main Notra product app (TanStack Start)
|  |- console/     # Companion/admin app (Next.js, port 3003)
|  |- docs/        # Product docs (Mintlify)
|  |- web/         # Public marketing site (TanStack Start)
|- packages/
|  |- db/                  # Shared Drizzle schema and DB helpers
|  |- email/               # Shared email templates/components
|  |- typescript-config/   # Shared TypeScript configs
|  |- ui/                  # Shared UI components
|- package.json
|- turbo.json
```

## Prerequisites

Install or prepare:

- **Bun** `1.4.4` (the version pinned in `package.json` and required for the Effect lint setup)
- **Node.js** `>= 24` (used by some tooling)
- A **Postgres** database (Neon or PlanetScale Postgres recommended)
- **GitHub** and/or **Google** OAuth app credentials
- Optional but commonly needed integrations:
  - Upstash Redis
  - Upstash QStash
  - Cloudflare R2
  - Brew (email)
  - Unkey

## Getting Started

1. Fork and clone the repository:

```bash
git clone https://github.com/YOUR-USERNAME/notra.git
cd notra
git remote add upstream https://github.com/usenotra/notra.git
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

4. Fill in the required values in `.env`:

- `DATABASE_URL`
- `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD` (auth is WorkOS AuthKit)
- OAuth provider credentials
- Any provider keys needed for the area you're working on

GEO captures Gemini and Google AI Overview through `CONTEXT_DEV_API_KEY` using
Context.dev's paid browser actions. ChatGPT keeps its Olostep batch route through
`GEO_OLOSTEP_API_KEY_ENV`. Both capture methods remain non-ZDR and require explicit
approval on enforced-ZDR projects. Context captures reject challenge pages,
unfinished answers, and missing citation metadata instead of recording a brand
miss; only a verified completed Google results page can report no Overview.
Stored Context answers include the provider, parser version, and request ID in
`grounding.capture`. Model API routes and existing engine IDs are unchanged.

Helpful provider docs:

- WorkOS AuthKit: https://workos.com/docs/authkit
- Neon: https://neon.com
- PlanetScale (if using PlanetScale Postgres): https://planetscale.com
- Upstash (Redis/QStash): https://upstash.com
- Unkey: https://unkey.com
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Brew: https://brew.new

5. Run database migrations:

```bash
bun run db:migrate
```

Content Gaps reads a saved snapshot per project. A project without one builds it
on its first read. Scans, Search Console syncs, and gap mutations refresh it,
and the dashboard's hourly `/api/cron/geo-content-gaps` job refreshes up to 25
missing or day-old snapshots per run. Keep `CRON_SECRET` configured in deployed
environments so rolling 30-day gaps continue to expire without page-load work.

6. Start development:

```bash
bun dev
```

Run a single app when needed:

```bash
bun dev --filter=dashboard
bun dev --filter=api
bun dev --filter=web
bun dev --filter=docs
bun dev --filter=console
```

The dashboard runs Vite on `127.0.0.1:3000`. Build it with
`bun run build --filter=dashboard`, then run `bun run start` from
`apps/dashboard` to serve Nitro's `.output/server/index.mjs`. Run
`bun run check-types --filter=dashboard` separately: `vite build` does not
perform the full TypeScript check. Existing `NEXT_PUBLIC_*`
deployment variable names remain supported; they are not framework dependencies.

## Demo human verification

New demo workspaces require Cloudflare Turnstile. `GET /api/demo/enter` only
redirects: it never claims a pooled workspace or triggers seeding. The demo start
page sends a single-use token to `POST /api/demo/sandbox`, which calls Siteverify
and checks both the action and the exact request hostname before claiming or
creating a workspace. Existing signed demo sessions do not need another check.
Reset/customize still require a signed session and retain their shared reset
budget; they do not grant a new anonymous session.

Before deploying this protection, configure the Unkey demo dashboard app's
production environment:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | The existing website widget's public site key, or a dedicated demo widget's key |
| `TURNSTILE_SECRET` | The matching widget secret; keep it write-only in Unkey |
| `TURNSTILE_HOSTNAMES` | `demo.usenotra.com` (exact hostnames, comma-separated if needed) |

In Cloudflare **Turnstile**, reuse the website widget if its hostname list already
allows `usenotra.com` (which also covers subdomains) or `demo.usenotra.com`.
Otherwise add `demo.usenotra.com` to that widget. Do not rotate the existing key
or change the website's variables. A dedicated widget should use **Managed** mode
with pre-clearance off. No DNS, proxy, WAF rule, or additional Worker is required.

The frontend uses action `turnstile-spin-v2`, automatic execution, and
`appearance: interaction-only`: normal visitors enter without clicking anything,
while Cloudflare can still request an interactive check when needed. The fraction
requiring interaction depends on Cloudflare's risk assessment, not an application
guarantee.

Missing configuration, missing or
replayed tokens, wrong action/hostname, and verification outages fail closed:
they cannot allocate workspaces. Configure keys **before** releasing the code or
new visitors will be unable to enter; existing sessions continue to work. The
50-workspace storage cap is unchanged. Monitor `reason` fields including
`turnstile_unconfigured`, `turnstile_invalid_token`, `turnstile_rejected`,
`turnstile_unavailable`, `invalid_admission`, `rate_limited`,
`reservation_lock_busy`, and `capacity_full` (with `sandboxCount`).

For local browser checks, use Cloudflare's test site key and matching test secret,
with `TURNSTILE_HOSTNAMES=127.0.0.1,localhost`, on loopback only. Never use test
keys or local authentication impersonation on a public deployment. Unit and
browser fixtures use synthetic tokens and stub verification; they do not contact
production services.

## Dub conversion tracking

Dub attributes signups and Stripe sales to Dub links. The analytics script runs
on both `usenotra.com` (`apps/web`) and `app.usenotra.com` (`apps/dashboard`)
behind the c15t `measurement` consent category. It stores the click ID in a
`dub_id` cookie scoped to `.usenotra.com`, so a link can land on either site and
the dashboard still sees the click.

The dashboard tracks the rest on the server. Creating a workspace sends a
`Sign Up` lead to Dub with the organization ID as `customerExternalId`, because
the organization is the Autumn and Stripe customer. The lead is sent after the
response with `waitUntil`, and only when the visitor's current c15t decision
still grants `measurement`, so a stale `dub_id` cookie is never enough on its
own. Both sites also delete `dub_*` cookies on `.usenotra.com` when measurement
is denied or withdrawn. Every Autumn `attach` and
`multiAttach` request gets `dubCustomerExternalId` added to its Stripe Checkout
metadata in `/api/autumn/[...all]`, and the Dub Stripe app records the sale and
later renewals from Stripe's webhooks.

A Dub customer is a workspace, not a user. Dub records one lead per workspace,
so a user who creates a second workspace after clicking a link shows up as a
second customer with its own lead.

The script stays behind consent for privacy reasons, so visitors who decline
measurement cookies are never attributed and Dub undercounts referrals. Partners
are told this in the Dub program description. A partner who can show that a
customer signed up through their link, for example with a screenshot, an email
thread or a matching signup date and email, can contact support and we credit
the commission manually in Dub. Do not switch the script to `alwaysLoad` to
recover these signups; the privacy policy says Dub only loads with consent.

Set `DUB_API_KEY` on the dashboard deployment. Without it, or without a `dub_id`
cookie, lead tracking is skipped. In the Dub workspace, `usenotra.com` and
`app.usenotra.com` must be listed under Allowed Hostnames, and the Dub Stripe app
must be connected to the Stripe account Autumn uses. The cookie domain means
attribution cannot be tested on `localhost`.

## Effect diagnostics

`bun install` patches TypeScript 7 and Oxlint with `@effect/tsgo`. Its native
language server replaces plain TypeScript-Go; do not run both language servers
side by side. In VS Code or Cursor, use the recommended native TypeScript
extension and select the workspace TypeScript version when prompted. The shared
TSConfig enables Effect diagnostics, quick fixes, and refactors.

Run `bun run check:effect` for the focused Effect rules across all workspaces
that directly depend on Effect. This is also part of `bun run check` and CI.
Floating Effects, missing `yield*`, and outdated APIs are errors. Nested Effects,
Promises in success channels, unsafe Effect casts, and dependent layers merged
with `Layer.mergeAll` are initially warnings. Typechecks also show the language
service's default diagnostics; warnings do not fail the typecheck, and
suggestions are omitted from CLI output. Existing Schema constructor overrides
are also baselined as warnings rather than blocking this tooling rollout.
Broad style/Effect-native lint presets are deliberately not enabled for our
mixed React, SDK, and Effect code.

If a new workspace adds Effect, include its source directory in `check:effect`.
Keep `@effect/tsgo`, TypeScript, Oxlint, and `oxlint-tsgolint` pinned to mutually
supported versions; the installed `@effect/tsgo/README.md` lists compatibility.

## AI prompt-cache diagnostics

Chat prompts put reusable rules in the first system message with an ephemeral
cache breakpoint, followed by workspace, date, skills, and integration context.
Keep request-specific data out of the first block. Tool definitions also form
part of the provider's cached prefix, so different tool sets do not share it.

Routed model calls log `firstSystemMessageHash`, `toolDefinitionsHash`,
`promptMessageCount`, and `assistantMessageCount` on `ai.call.started`, without
logging prompt contents. Join to `ai.call.completed` by `callId` to compare cache
read/write tokens and latency for matching prompt/tool hashes, model, gateway,
and upstream provider. Also compare total cost and calls per task: a higher cache
hit rate alone does not establish savings. Provider token thresholds, cache
lifetime, and routing still determine whether a matching prefix is reused.

## QStash Local Workflows

If you're testing webhooks or workflows with QStash, set `NEXT_PUBLIC_APP_URL` to a public URL. `localhost` will not work for external callbacks.

Use Cloudflare Tunnel (`cloudflared`) to expose your local app:

- Install `cloudflared`:

macOS

```bash
brew install cloudflared
```

Windows (PowerShell)

```powershell
winget install --id Cloudflare.cloudflared
```

- Create and run a local tunnel to your app (for example, dashboard on port 3000):

```bash
cloudflared tunnel --url http://localhost:3000
```

The dashboard's Vite dev server binds to `127.0.0.1` so LAN clients cannot reach the process and
spoof `Host: localhost`. Leave `DEV_AUTH_ENABLED` unset (or `false`) before
exposing the app. Local-dev impersonation only works on loopback and requires
both `DEV_AUTH_ENABLED` and `DEV_AUTH_EMAIL`. A public tunnel must use a live
WorkOS API key so visitors are not signed in as a database user.

- Copy the HTTPS tunnel URL and set:

```bash
NEXT_PUBLIC_APP_URL=https://your-public-tunnel-url
```

If you need a stable or custom URL, use a locally managed tunnel setup from the official docs:
https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/

## Build performance

The web and dashboard apps enable incremental TypeScript checking in their
`tsconfig.json` files, overriding the shared base config. Keep this enabled.
Both apps' standalone type checks write to `.cache/typecheck.tsbuildinfo`.
Their Vite builds and Nitro output are separate from type checking: a successful
build does not mean TypeScript passed. Run `bun run check-types` separately;
the code-quality workflow already does this for both apps.

Turbo caches completed Nitro artifacts in `.output` and `.vercel/output`, plus
the web app's generated `.source` files. Neither app uses `.next/cache` or
Turbopack's filesystem cache.

When comparing deployments, measure compilation, TypeScript, static generation,
and output deployment separately. Vercel's `Creating build cache` phase occurs
after `Deployment completed`; it is not additional time until the app is live.
Both projects use filtered Turbo build commands and skip unaffected projects.
Preserve those settings when changing the Vercel configuration.

Dashboard workflow steps use CommonJS on Vercel. Keep their external packages in
`WORKFLOW_EXTERNAL_PACKAGES` so Nitro traces the `require` entries as well as its
ESM imports. After `VERCEL=1 bun run build` in `apps/dashboard`, run
`bun run test:workflow-production` to check the isolated function's dependencies
and native image processing. CI runs this check after the dashboard Vercel build.

Standalone `check-types` scripts that run `tsc` enable incremental checking in
their TypeScript configuration or with command-line flags, and write to
`.cache/typecheck.tsbuildinfo` within each package. Run them through
`bun run check-types` (optionally with `--filter`) to reuse this state. These
overrides apply to type checks without changing Eve or tsup builds. The files
are already ignored by Git's `*.tsbuildinfo` rule and are declared as Turbo task outputs.

The code-quality workflow restores these files using a cache key scoped to the
runner platform, dependencies, configuration, and commit. A matching prefix can
restore state from an earlier commit; TypeScript still checks changed source and
its affected dependents. The workflow retains its existing package selection.
Blume's `ui` app uses its own checker and does not produce this cache file.

## Database Workflow

Common Drizzle commands from the repo root:

```bash
bun run db:generate
bun run db:check
bun run db:migrate
bun run db:push
bun run db:studio
```

Commit generated SQL and `packages/db/migrations/meta/_journal.json` together.
`db:check` rejects orphan SQL, missing files, invalid journal ordering, and new
prefix collisions. Two historical prefix pairs are grandfathered; do not rename
applied migrations or change their journal timestamps. CI compares the journal
against the PR base or previous main commit to enforce append-only history. Run
`bun run db:check --base=origin/main` locally for the same comparison. CI also
replays the full journal on an empty Postgres database and runs it again to check
rerun safety.

Sites branch workflow uses `0128_sites_branch_workflow`, after
`0127_site_deployment_repository`. It keeps deployment drafts and their legacy
unique index compatible with the running app; feature-branch drafts use a
separate table. The CI branch-workflow step also tests writes from both app
versions.

Content Git publishing uses `0129_content_git_publishing`, after
`0128_sites_branch_workflow`. It adds the review-process default and allows
terminal direct publications without pull-request fields. CI tests both empty
and populated tables, old writers, and repeated application of the migration.

The obsolete SQL files `0019_add_post_recommendations`, `0036_lovely_wallop`, and
`0090_user_auth_security` were unjournaled and have been removed. Their active
schema changes are covered by `0019_medical_peter_parker`, `0000_baseline`, and
`0100_complete_robin_chapel`. Authenticator factor labels are no longer used.

Dashboard production builds validate migrations, build, and prune the build cache
before migrating the database. Migrations must remain compatible with the running
app because Vercel has not yet promoted the new deployment at that point.

Seed helpers:

```bash
bun run db:seed
```

## Brand OG images

Autopilot and the `generateOgImage` agent tool share
`packages/ai/src/utils/og-image.ts`. On first use, the pipeline researches the
publishing brand's public website, designs a structured template, renders two
probe titles, and scores the PNGs for brand fidelity, typography and composition.
It stops at the first approved design within a three-attempt repair budget and saves it in
`brand_og_templates`. Subsequent titles render without model calls. Templates
expire after 30 days, generator revisions or saved brand guideline changes. Failed refreshes
use the last working template; first-use failures return a plain fallback with
warnings rather than caching a generic design.
Design calls use Opus 5.5; visual approval uses Sonnet. Each call is priced before
Autopilot aggregates usage across models. A cold design has a three-minute budget.
A short PostgreSQL transaction claims a durable per-brand lease; research, model
calls and rendering never hold that transaction open. Contending requests return
the last-good/plain fallback without waiting. Quality failures and exhausted design
budgets back off for six hours across workers and deployments. Infrastructure
failures, expired leases and caller cancellations after a model call starts have
a one-minute cooldown; failures before any call starts have no cooldown. Explicit
caller cancellation still cancels the request, and stale owners cannot save.
`brand_og_design_runs` records ownership/outcomes; `brand_og_design_calls` records
each call before spending, with token estimates separate from gateway-reported
costs. Missing usage remains unknown, never zero. The authenticated monitoring cron
retries pending gateway generation IDs for seven days, in bounded batches ordered
by their last check time, without delaying image generation. The first lookup is
eligible after one minute; unresolved IDs retry at most hourly. SDK-level model
retries are disabled to avoid stacking them on the router's bounded gateway fallback.
This reconciles cost
history, not credit charges; provider failures without generation IDs remain unknown.
A title that does
not fit a fresh cached template uses the plain fallback without a paid redesign.
Unsupported characters fail explicitly rather than silently producing glyph boxes.

Apply the committed migration with `bun run db:migrate` before deploying. The
pipeline uses the existing AI gateway and `CONTEXT_DEV_API_KEY`; agent image
uploads use the existing R2 configuration. Autopilot attaches PNG bytes directly
to its generated pull request. WOFF2 fonts are converted at runtime; unsupported
or unavailable brand fonts use Inter and report a warning.

Run the opt-in live check from `packages/ai` with development provider credentials:

```bash
bun --no-env-file scripts/og-image-smoke.ts /path/to/dev.env /path/to/output [domain ...]
```

For offline durability verification (no provider keys or paid inference), run
`bun --no-env-file scripts/og-image-durability-smoke.ts` from `packages/ai`.
It replays the migrations and checks leases, interruption, stale owners, backoff,
ambiguous save commits, usage delivery failures and delayed cost reconciliation.
The normal AI package test command also runs this smoke check, including saved
font download discovery and preservation of explicitly selected brand choices.

It replays all committed migrations in an isolated in-memory PostgreSQL instance,
seeds synthetic brands, lets a real agent call the tool, then checks Autopilot
reuses the template for a longer title. Only AI/context provider keys are loaded
from the supplied file, never its database, billing or storage credentials.
The real S3 upload client writes to a loopback test server with dummy credentials,
and the returned image URL is fetched back and checked. No real R2 bucket is used.
The output includes PNGs, a gallery, per-brand research evidence, source hashes
and a JSON report with research timing and model-reported usage per call. Input
usage separates uncached, cache-read and cache-write tokens; include all three
when comparing total prompt size. Outer agent usage is reported separately.
Fallback images fail the smoke check. Pass domains to select test brands.
The reviewer inspects isolated placed assets as well as the two finished cards,
rejecting partial wordmarks and accidental raster-patch seams. Standalone
wordmarks must remain uncropped and use `contain`.
Do not redistribute downloaded font files in
fixtures; confirm your brand's font licensing permits server-side rendering.

For a visual benchmark, run the smoke check on the baseline and candidate revisions
into separate output directories, then compare them with a different model family:

```bash
bun --no-env-file scripts/og-image-benchmark.ts /path/to/dev.env /baseline /candidate /comparison
```

The evaluator sees anonymous A/B pairs with both title lengths and the same brand
references, twice with reversed order. `review.json` preserves scores, defects and
preferences; these are model judgments, not objective design-quality measurements.
Both directories must contain the same selected brands. Failed/fallback results
remain in the visual comparison and are labeled in its JSON; missing saved
templates are explicitly skipped for warm-render timing. Captured baseline
research supplies the common evaluator references when available.
Smoke reports include first-generation and cached-render wall time. Inspect the
actual images too. No images, downloaded fonts or benchmark logs belong in git.
`render-timings.json` measures each saved template with the current renderer:
one warm-up, then ten alternating short/long-title renders, reporting median and p95.
Model-only logo/art previews are downsized without changing cached render assets.
Research compacts repeated font URLs while retaining their supported weights;
stable design evidence precedes attempt-specific feedback for prompt caching.

## Making Changes

1. Create a branch:

```bash
git checkout -b feat/short-description
```

2. Run quality checks before you commit:

```bash
bun run format
bun run check
bun run check-types
bun run build
```

3. Commit with clear [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) messages:

```bash
git commit -m "feat(dashboard): add integration activity filters"
```

## Landing Page Copy Sync

If you update landing page copy in `apps/web/src/components/landing/landing-page.tsx`, also update the markdown version in `apps/web/src/utils/site-markdown.ts`.

We keep both in sync so the website and markdown endpoint (`/markdown`) say the same thing.

## Pull Request Guidelines

- Explain the problem and why this change is needed.
- Keep PRs focused and reasonably small.
- Link related issues when applicable.
- Include screenshots or recordings for UI changes.
- Update docs when behavior, APIs, or setup steps change.
- Make sure checks pass before requesting review.

## Code Style

### Ponytail and agent skills

[Ponytail](https://github.com/DietrichGebert/ponytail) runs in full mode by default.
Run `bash scripts/setup-ponytail.sh` from a checkout with Codex and Claude Code
installed. This installs the native plugins, including session-start,
subagent-start, and prompt-submission hooks. Node must be on the non-interactive
shell's PATH.

- **Codex:** the setup script installs the plugin into the user's Codex plugin
  cache, pinned to commit `e3ba2aa6f1e6f0bc4d69eb09c9f0d0a93af56156` (4.10.0).
  Open `/hooks`, review and trust Ponytail's hooks, then start a new task.
  Restart the desktop app to pick up the plugin. Hook trust is per machine and
  cannot be shared through Git.
- **Claude Code:** `.claude/settings.json` declares and enables the upstream
  marketplace plugin for this project. The plugin provides all six namespaced
  commands and lifecycle hooks. The project status line uses the upstream
  `.claude/ponytail-statusline.sh` to display the active mode. Its MIT license
  is in `.agents/skills/ponytail/LICENSE`.
- **OpenCode:** `opencode.jsonc` installs `@dietrichgebert/ponytail@4.10.0` on
  startup, providing per-turn instructions, persistent mode switches, and all
  six slash commands. Restart OpenCode after changing this config.
- **Amp:** `AGENTS.md` enables Ponytail for coding tasks and `.agents/skills/`
  supplies all six skills. Upstream has no Amp lifecycle-hook adapter; mode
  changes are instructions in the current conversation.

Use `ponytail lite`, `ponytail full`, `ponytail ultra`, or `ponytail off` to
choose a mode. The companion skills are `ponytail-review`, `ponytail-audit`,
`ponytail-debt`, `ponytail-gain`, and `ponytail-help`. Claude plugin commands
are namespaced (for example `/ponytail:ponytail ultra`); OpenCode uses
`/ponytail ultra`. In Codex, select the plugin skill or mention it with `$`.
The native plugins support `PONYTAIL_DEFAULT_MODE` and
`~/.config/ponytail/config.json` for the default level.

Shared skills are committed under `.agents/skills/`, with upstream sources and
hashes recorded by the [skills.sh CLI](https://skills.sh/) in `skills-lock.json`.
Refresh them with `bunx skills update --project --yes`. This does not update
native plugins: rerun the setup script after changing the Codex pin, update
Claude's marketplace plugin through `/plugin`, and change OpenCode's version
in `opencode.jsonc` when upgrading it. Keep skills relevant to the current stack
or explicitly invoked workflows. Next.js Cache Components skills are not needed
for the TanStack Start apps; the incomplete `grill-me` redirect was also removed
because its target skill was not installed. Remove a retired skill's directory,
its `skills-lock.json` entry, and any `.claude/skills/` symlink together.
Review updates before committing, including references to other required skills.
Upstream email skill test scenarios are omitted. `.vercelignore` excludes
agent files and setup tooling from deployment uploads.

`AGENTS.md` holds shared, repository-specific guidance; `.claude/CLAUDE.md`
imports it rather than duplicating general coding rules. Keep setup instructions
in this guide and use the committed lint configuration as the style authority.
Do not add cloud-image assumptions or pre-provisioned database credentials to
shared agent instructions.

### Conventions

- Follow existing patterns in the touched area.
- Use Ultracite's Oxlint and Oxfmt provider via the repository scripts.
- Prefer readable, self-documenting code.
- Add comments only when logic is not obvious.

## Reporting Bugs and Requesting Features

- Use GitHub Issues.
- Search existing issues first to avoid duplicates.
- Include clear reproduction steps, expected behavior, and actual behavior.

## Need Help?

Open an issue or start a discussion in the repo.

Thanks for helping improve Notra.

## GEO coding-agent credentials

GEO's OpenCode, Claude Code, Codex, and FX engines require both `UPSTASH_BOX_API_KEY` for
sandbox access and `AI_GATEWAY_API_KEY` for model calls through Vercel AI
Gateway. They do not use Upstash's managed LLM key or its spending allowance.

## Client IP and rate limits

IP rate limits read the client address from `getClientIp` in
`@notra/utils/client-ip`, which trusts only a header the deployment's edge sets:

1. On Vercel (`VERCEL=1`), the first `x-vercel-forwarded-for` entry.
2. On Unkey (`UNKEY_DEPLOYMENT_ID` set by the runtime), `x-forwarded-for`,
   which Unkey replaces with one client IP.
3. Anywhere else, only the header named in `TRUSTED_PROXY_HEADER`.

Under 2 and 3, `cf-connecting-ip` is used only when that peer is a Cloudflare
edge. When you self-host behind a reverse proxy, set `TRUSTED_PROXY_HEADER` to
a header the proxy overwrites with exactly one client IP (nginx:
`proxy_set_header X-Real-IP $remote_addr;` with `TRUSTED_PROXY_HEADER=x-real-ip`).
Never set it on a server that clients reach directly: they could then send
any address and dodge the limits. Without a trusted header, every client
shares one `unknown` bucket per limit, and production logs a warning once.

## Demo deployments on Unkey Compute

The demo has two **separate** Unkey Compute apps. Both use this monorepo as
their source; neither should use automatic language detection.

| Setting | Demo dashboard | Demo API |
| --- | --- | --- |
| Repository / branch | `usenotra/notra` / `main` | `usenotra/notra` / `main` |
| Root directory (Docker build context) | `.` | `.` |
| Dockerfile | `apps/dashboard/Dockerfile` | `apps/api/Dockerfile` |
| Port | `3000` | `3000` |
| Health check | `GET /api/healthcheck` | `GET /ping` |
| Custom domain | `demo.usenotra.com` | `demo-api.usenotra.com` |

Leave the runtime command unset to use each Dockerfile's exec-form `CMD`.
Both servers honor Unkey's injected `PORT`; do not set `NITRO_PORT` or
`NITRO_HOST` overrides. Start the dashboard with one replica in one region,
without scale-to-zero. It retains the existing file-backed Workflow Local
World: files go to `/tmp/notra-workflows`, not a persistent disk. In-flight
workflows/streams can be lost on restart or deployment. Database-backed demo
sandboxes survive, but this is **not** a durable multi-replica workflow setup.
Use a shared production Workflow World before enabling multiple dashboard
replicas or requiring jobs to survive deployments. Unkey's ephemeral disk
does not solve cross-instance workflow storage.

### Environment and database

Import the **demo-only** configuration separately into each app's production
environment. Do not import the main product's `.env` or WorkOS credentials.
`isDemoMode()` intentionally returns false if `WORKOS_API_KEY` is set. Leave
`WORKOS_API_KEY` and `DEV_AUTH_ENABLED` unset on both apps, and do not share
production Postgres, Redis, or API-management credentials with the demo.

Both apps need:

```dotenv
NOTRA_DEMO_MODE=true
DATABASE_URL=postgresql://...demo-only-database...
UPSTASH_REDIS_REST_URL=https://...demo-only-redis...
UPSTASH_REDIS_REST_TOKEN=...
UNKEY_ROOT_KEY=...demo-api-management-root-key...
INTEGRATION_ENCRYPTION_KEY=...demo-only-key...
WORKFLOW_BASE_URL=https://demo.usenotra.com
```

The dashboard also needs:

```dotenv
NEXT_PUBLIC_NOTRA_DEMO_MODE=true
UNKEY_API_ID=...demo-keyspace-id...
APP_URL=https://demo.usenotra.com
NEXT_PUBLIC_APP_URL=https://demo.usenotra.com
NEXT_PUBLIC_SITE_URL=https://www.usenotra.com
WORKOS_COOKIE_PASSWORD=...random-demo-only-secret-at-least-32-characters...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...demo-widget-site-key...
TURNSTILE_SECRET=...matching-demo-widget-secret...
TURNSTILE_HOSTNAMES=demo.usenotra.com
```

The API also needs `NOTRA_DEMO_DASHBOARD_ORIGIN=https://demo.usenotra.com`
for CORS. Both apps use `NOTRA_DEMO_API_URL` to override the default
`https://demo-api.usenotra.com` (for example before the custom-domain cutover).
The dashboard returns this runtime value to its API console through the sandbox
info endpoint; `NEXT_PUBLIC_NOTRA_DEMO_API_URL` is no longer used. Move any
custom value to `NOTRA_DEMO_API_URL` when upgrading.

Leave `AUTUMN_SECRET_KEY`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and
`QSTASH_NEXT_SIGNING_KEY` unset: the demo bypasses billing without an Autumn
key and simulates queue operations without sending messages. Normal production
API deployments still require both Autumn and QStash credentials. The API does
not need `UNKEY_API_ID`; only the dashboard creates sandbox keys. Keep optional
services the demo uses (for example logging or object storage) scoped to demo
as well. The demo has no consent banner, so it loads no Databuddy analytics.

Unkey provides these variables at build time via its BuildKit secret mount.
The dashboard Dockerfile declares `UNKEY_SECRETS_ID` and sources that file in
the build step. `NEXT_PUBLIC_*` values are compiled into browser assets;
redeploy after changing them. Never put secrets in public variables or Docker
build arguments. The API reads its configuration at runtime.

Both apps must point at the **same dedicated demo Postgres database**. Use
the existing demo database if retaining sessions, or initialize a new empty
one with the committed migrations **before starting either app**. From a
trusted shell with only the demo connection exported:

```bash
# DATABASE_URL must point to the demo database, never the main product database.
bun run db:migrate
```

Alternatively, run `/migrate/run.sh` as an entrypoint override on the built
dashboard image with `MIGRATION_DATABASE_URL` set to a direct demo connection.
Do not run migrations during image builds or on every replica's startup.
The scheduled release migrates the demo database itself: before the first
demo build, it runs the committed migrations with the GitHub Actions secret
`DEMO_MIGRATION_DATABASE_URL` (a direct `neondb_owner` connection to the demo
database, not the pooler). Without that secret, both demo apps are skipped and
keep their current build; a failed migration stops both demo builds. After
the demo deploys, the release calls `/api/healthcheck?deep=1` on the demo,
which selects every column of every table through the app's own database role
(no rows) and fails with the first missing table or column. Sandbox seeding and
pool cleanup happen on visitor requests, not through a cron.

### First deployment and cutover

1. Create both Unkey apps with the settings and demo environment above.
   Leave gateway API-key authentication policies **off**: the dashboard is
   anonymous, and the API performs its own key checks. Do not add a gateway
   policy that blocks public probes, CORS preflights, or streaming responses.
2. Apply demo migrations, deploy the API, then deploy the dashboard. Verify
   both probes on their Unkey domains before touching DNS. For a functional
   test before cutover, use the temporary Unkey dashboard/API URLs consistently
   in the environment above (including the API's dashboard origin), rebuild,
   then restore the custom-domain URLs and rebuild for cutover.
3. Attach and verify the two custom domains using the DNS records Unkey gives
   you. Keep any Cloudflare proxy configuration consistent with the demo's
   embedding and streaming requirements. Client-IP limits use Unkey's
   overwritten `X-Forwarded-For`, and only trust `CF-Connecting-IP` when that
   peer is a Cloudflare edge. Do not override `UNKEY_DEPLOYMENT_ID` yourself.
4. Check `/api/healthcheck` (including `commitSha`) and `/ping`, then open
   the demo directly and inside the landing-page iframe. Verify anonymous
   entry, seeded GEO data, sandbox reset, a generated demo API key, a real
   request from the API console, request-log updates, and one streaming chat
   or content-generation run. A green liveness probe alone is not sufficient.

For scheduled releases, use the existing GitHub Actions secret `UNKEY_DEPLOY_ROOT_KEY`
with read access to every enabled Unkey app, its production environment, domains and
deployments, and write access to its deployment collection. All Unkey releases use
this single shared CI credential, separate from runtime `UNKEY_ROOT_KEY`.
After all four Unkey custom domains are verified and have current healthy deployments,
run **Production deploy** with `dry_run` checked. Then disable production
**Auto deploy** on both demo apps (keep their GitHub connection) and run a real
release. The script checks all targets before any builds, migrates the demo
database once, then deploys all four services in parallel and verifies the
exact checked commit is current on each. The shared
`UNKEY_DEPLOY_ROOT_KEY` enables all four Unkey releases; no additional flags are
needed. Without the key, the demo apps are not released.
Inaccessible Unkey targets fail closed, without permission-error fallback.
Provider rollback requires an explicit release-routing change; it
does not switch DNS, move data, or roll back a running deployment. Restore and
verify the intended provider/domain separately using only demo/test credentials.

References: [Docker build secrets](https://www.unkey.com/docs/compute/build/build-secrets),
[runtime variables](https://www.unkey.com/docs/compute/configure/environment-variables),
and [proxy headers](https://www.unkey.com/docs/compute/networking/request-lifecycle).

After a node-server demo build, run `bun run test:demo-production` from
`apps/dashboard`. It boots a copy of only `.output` from a temporary directory
without credentials or a database, and checks the injected port, health commit,
HTTPS proxy redirects, and graceful shutdown. It does not replace the functional
checks against dedicated demo services above.
For the API, run `bun run build && bun run test:production` from `apps/api`.
The build traces the external `@resvg/resvg-js`, `sharp`, and `wawoff2` runtimes
into `dist`, including their native bindings and WASM assets. The production
artifact check renders and resizes an image, exercises the font decoder, and
boots `/ping` from an isolated copy with synthetic configuration. CI runs this
check inside the API's Alpine Linux amd64 image without external network access.

## Production releases and Vercel build selection

All five Vercel app configurations disable automatic Git deployments with
`git.deploymentEnabled: false`. Pushing a branch, opening a PR, or merging into
`main` therefore does not start a Vercel preview or production build. Local
development and GitHub's code-quality checks continue to run as before.

The [Production deploy workflow](.github/workflows/production-deploy.yml) releases
`dashboard` (`notra`), `web` (`notra-web`), `ui` (`notra-ui`), `agent`
(`notra-agent`), and `onboarding-agent` (`notra-onboarding-agent`) at **12:00 and
19:00 Europe/Berlin** each day. The timezone includes daylight-saving changes;
GitHub may start scheduled runs late. Production remains on `main`.

Before merging this configuration, add a GitHub Actions repository secret named
`VERCEL_TOKEN` containing a token with access to the Notra team's five projects.
The team ID is configured in the workflow. No application secrets or local
Vercel login tokens need to be copied into the repository. Keep Vercel's GitHub
repository connection enabled so the API can build the pinned Git commit.

The workflow uses the exact `main` SHA captured when the run starts. Its latest
push runs of **Code quality** and **Knip** must have completed successfully;
Code quality includes the unit/integration suite and type checks. Missing,
running, cancelled, or failed checks prevent all builds for that release window.
There is no automatic deployment when CI finishes later; the next scheduled
window checks again.

The deploy job starts alongside the release gates (the Sites E2E suite and the
agents boot check) instead of after them. Meanwhile it installs, plans every
target and builds the sites toolchain snapshot, which only changes the
environment of future dashboard builds. Before the first live change it waits
for the latest run of every gate job in the workflow run to succeed; a failed,
cancelled, skipped or missing gate job ends the release with nothing deployed.

Each project is compared with the deployment serving its stable production alias
(`notra-notra.vercel.app`, `notra-web-notra.vercel.app`,
`notra-ui-notra.vercel.app`, `notra-agent-notra.vercel.app`, or
`notra-onboarding-agent-notra.vercel.app`). The script resolves that alias to a
deployment ID, then reads its commit SHA. A missing alias, wrong project, or unidentified live
commit blocks all new builds. Neither the latest successful build nor
`targets.production` is used as a substitute: the latter can refer to a skipped
build that was never published. GitHub must confirm the
selected commit is ahead of each project's production commit, or already identical.
An older workflow rerun, diverged history, or a failed history lookup blocks all new
builds. This prevents
old runs from overwriting newer releases; use Vercel's rollback flow for a
deliberate rollback.

Changes in a project's own app directory trigger a build; shared packages and
inputs outside `apps/` conservatively trigger all five. Changes confined to
another app are skipped. Renames are compared as a deletion and an addition so
moves between apps rebuild both. After the history check passes, missing local
historical Git commits cause a build rather than an unsafe skip. Any
already-active production build blocks the release before new builds start.

The API requests use the same checked commit SHA and the `production` target for
every project. Each project's existing build command, environment, migrations,
and build cache remain in use. The workflow waits for `READY`, verifies the built
SHA and that the production alias points to the new deployment, and reports
failures in the Actions summary. Polling is limited to ten minutes
per project. Each enabled Unkey service has a 20-minute polling limit. All phases, preflight and local builds share the
workflow's 120-minute job limit; that limit can expire before every provider's
individual polling allowance is exhausted when multiple Unkey services are enabled.
Projects deploy independently; a failed project does not roll back another
project's successful deployment.
Deployment creation is not automatically retried, since a timed-out request may
already have started a build.

The production API at `api.usenotra.com` is hosted on Unkey Compute, not the
demo API. Its scheduled release is opt-in: add the GitHub Actions
secret `UNKEY_DEPLOY_ROOT_KEY` to enable it. Without that secret, the workflow
reports that the API remains outside the scheduled release and continues releasing
the other services. Use a separate deployment root key from the API's runtime
`UNKEY_ROOT_KEY`; no new application `.env` values are needed.

The script discovers the target from the exact verified `api.usenotra.com` domain
using [Unkey's domain API](https://unkey.com/docs/compute/api-reference/domains/list-domains).
It verifies the app's connected repository and `main` branch, the production
environment, its current live deployment and Git history, and the absence of
active deployments or a rollback. Configured but inaccessible or invalid targets
prevent all new builds; the script does not fall back to an unrelated project.
Give the Compute-workspace root key read access to this app, its production
environment, domains and deployments, and write access to its deployment
collection. It does not need environment-variable access, environment-setting
write access. The same key must cover all four Unkey apps. See the
[root-key permission reference](https://unkey.com/docs/platform/root-keys/permission-reference).

To activate after merging, add the secret and run **Production deploy** with
`dry_run` checked. This performs read-only preflight requests and reports the
planned API deployment; it allows auto deploy to remain enabled during inspection.
After a successful dry-run, turn off **Auto deploy** for the API's production
environment under Unkey **App Settings → Build settings**, preserving its GitHub
repository connection and preview settings. Then run a manual production release
and verify it. Real releases refuse to run while production auto deploy is enabled
or cannot be verified as disabled. Never disable the existing trigger before the
replacement configuration is ready.

Changed API builds use [createDeployment](https://unkey.com/docs/compute/api-reference/deployments/create-deployment)
with the exact checked `git.commitSha`. After the Vercel releases succeed, the
workflow rechecks the API's production configuration, active deployments and live
commit before creating its build. An intervening newer release, rollback, or domain
target change blocks the API deployment; an intervening release of the selected
commit skips the duplicate build. It then polls for up to 20 minutes until that deployment is
`ready`, has the expected target and commit, and is current in production. Deployment creation is not retried, and no
provider settings are changed by the workflow. The release is not atomic: an API
failure does not roll back Vercel projects that have already published.

AI traffic ingestion is also prepared for **Unkey Compute hosting**, separately
from Unkey API-key management. The operator must create and initially deploy the
ingest app, set its runtime variables, validate an isolated origin and the host's
termination grace, and switch/verify `ingest.usenotra.com` before enabling its
scheduled release. Follow the [ingest deployment and rollback runbook](apps/ai-traffic-ingest/README.md).
This repository change does not perform the provider migration or alter DNS.

Ingest uses the same guarded Compute release path whenever the existing
`UNKEY_DEPLOY_ROOT_KEY` repository secret is configured. No additional variable
or deployment secret is needed.
It discovers the exact verified `ingest.usenotra.com` domain rather than using a
hardcoded app ID, checks the
connected repository/main/production environment, rollback and active-deployment
state, current live commit and history, then pins the selected SHA in a v3
deployment request. The target is rechecked after Vercel and the workflow waits
for that deployment to be ready and current on the expected target and SHA.
Inaccessible or invalid configuration fails closed.

Grant the shared Compute-workspace deployment root key read access to all four
apps, environments, domains and deployments and deployment-create access to all
targets. Permission failures stop the release without fallback. Keep this CI-only
key separate from runtime keys; it needs no Turbo environment declaration or
runtime `.env` addition. Configuring the key enables the API, ingest and both demo
services.

Preflight runs before CI's local builds, again before provider builds, and each
Unkey target is rechecked immediately before its deployment. A failed Unkey
preflight prevents all builds. A later Unkey failure fails the release
but cannot undo already published Vercel or Unkey deployments. To activate ingest,
first complete the initial app deployment and domain verification, then configure
the shared key and run a read-only `dry_run` while its existing trigger
remains enabled; only when that succeeds and the replacement schedule is ready, disable ingest's
production **Auto deploy** and verify a manual real workflow run. Removing the
shared key disables all four Unkey releases, not just ingest.

For an urgent release, open **Actions → Production deploy → Run workflow**, select
`main`, and leave `dry_run` unchecked. This uses the same CI and change checks.
Check `dry_run` to validate configuration and report planned deployments without
creating builds. A manual release is an explicit exception to the two daily
windows. Rollback and direct CLI deployments remain available through Vercel.

After merging, run the workflow once with `dry_run` checked, then verify the
first scheduled production release. Preparation and automated tests do not
verify Vercel's live build/delivery behavior. Do not disconnect the GitHub
integration or replace the configs with `github.enabled: false`.

Keep Vercel's **Skip unaffected projects** setting enabled for the Git-deployed
apps (`web`, `dashboard`, and `ui`). The scheduled script performs its own
conservative change check before requesting a build. Vercel uses the workspace
dependency graph
to skip projects whose source and dependencies have not changed. Each workspace
must have a unique package name and explicitly declare its internal dependencies
in `package.json`.

`agent` and `onboarding-agent` have `git.deploymentEnabled: false` in their
`vercel.json` files. Pushes and merges do not deploy them. They now participate
in the same scheduled and manually dispatched production release as the other
Vercel apps, with their own live-alias, history, and change checks.

The app configs do not set an `ignoreCommand`. Keep
[Vercel's built-in skipping](https://vercel.com/docs/monorepos#skipping-unaffected-projects)
enabled alongside the scheduled script's change check. Keep the project's
Ignored Build Step setting at its default so it does not run an old custom
command after the repository override is removed.

Changes outside the workspace definitions, such as root documentation, can
select builds during a scheduled release. Shared Bun lockfile changes can select
all five projects as well.

Root install configuration and the prepare script remain declared in
`turbo.json#globalDependencies` for build cache invalidation. Declare any new
shared build inputs there too.

## GitHub export signing key

Commit messages from GitHub content exports carry a signature that can't be
rewritten later, so `GITHUB_CONTENT_EXPORT_SIGNING_KEY` signs them separately
from `INTEGRATION_ENCRYPTION_KEY`. It falls back to the encryption key when
unset. Keep it set to the same value permanently, including when the
encryption key is rotated.

## Automated tests

Run the complete suite from the repository root:

```bash
bun run test
```

This runs tests in `@notra/ai`, `@notra/geo-core`, and `dashboard`. To focus on
one area, use `bun run test --filter=@notra/geo-core` (or `--filter=dashboard`,
`--filter=@notra/ai`). Use `bun run test --force` to bypass Turbo's test cache.
The **Tests** GitHub Actions job runs the suite and typechecks these packages
on every push and pull request with a frozen lockfile. No database server, `.env`, API keys, or paid model
calls are required by these tests.

Coverage includes:

- **GEO cron and scan persistence:** real Drizzle queries against an isolated
  in-memory PGlite Postgres instance. DDL is generated from the production
  tables, including indexes and foreign keys. Tests cover due/disabled/busy
  projects, overlapping triggers, sweep limits, claim renewal, stale workers,
  abandoned scans, hand-off failures, tenant ownership, and finalization.
- **Cron HTTP contract:** authorization, missing secrets, response counters,
  propagated failures, and registration in `vercel.json`.
- **Scan workflow orchestration:** task/sequence batches, renewed claim tokens,
  accumulated results, partial failures, and the single no-results retry.
- **GitHub polling:** [Vercel Labs Emulate](https://github.com/vercel-labs/emulate)
  starts a local stateful GitHub API. Tests use Octokit over HTTP and create
  releases through the API. Repository discovery and credential lookup are
  test doubles; API responses and signal conversion run for real. Drafts,
  prereleases, lookback windows, missing repositories, and deduplication keys
  are covered.
- **Content schedule timing:** delayed deliveries, UTC scheduling, leap dates,
  month boundaries, and daylight-saving transitions.

Tests under `tests/` run separately from `src/` in the dashboard and AI package
because Bun's `mock.module` replacements live for the entire test process.
Keep infrastructure replacements at the boundary; do not mock the function
being tested. Reset database/emulator state between scenarios and close servers
in teardown. Import only `bun-types/test` in TypeScript configuration so Bun's
global `fetch` extensions do not change the application runtime types.

Dashboard browser regressions run separately with `bun run test:browser` from
`apps/dashboard`. Install Chromium once with `bunx playwright install --only-shell chromium`.
The suite mounts local UI fixtures without application credentials; CI installs
the browser and runs it in the Code quality test job.

These are not deployed end-to-end tests. PGlite serializes database requests,
so overlapping-call tests do not reproduce separate Postgres connections.
Workflow orchestration tests replace steps and `sleep`; they do not verify
Vercel's durable runtime, restart recovery, or actual cron delivery. Live model
answers, billing providers, and the committed database migration chain are also
outside this suite.

The Code quality job also builds the website and runs `bun run test:production`
from `apps/web`. This starts the production artifact from an empty directory and
checks the Markdown endpoints without access to the source tree. Run
`bun run build --filter=web && (cd apps/web && bun run test:production)` locally.
