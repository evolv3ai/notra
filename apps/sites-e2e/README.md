# Sites local browser E2E

This workspace compiles the existing Acme fixture twice (live and protected
preview), seeds the output into a local R2 bucket and serves it through the
**production Sites Worker entry point in `workerd`** (`wrangler dev --local`
with the real R2 binding, Cache API, `HTMLRewriter` and password rate limiter;
only the hosting domain, secret and ingest URL differ from production). An
isolated Chromium profile drives it with Playwright. No database, `.env`,
account, cloud resource, or live provider credential is needed.

The separate connected PostgreSQL lifecycle test is run by
`sites:e2e:dashboard --database-regressions`; see
[`scripts/testing/dashboard/README.md`](../../scripts/testing/dashboard/README.md).
It joins real database, publisher and handler logic with every external
provider emulated on loopback ([`emulators/`](emulators/README.md)): GitHub,
R2, the Upstash Box API, Cloudflare for SaaS, Vercel DNS and DNS itself. With
`--box`, builds run in real Upstash Boxes instead of the Box emulator. Only
name moderation is stubbed. It requires Docker, and `UPSTASH_BOX_API_KEY` for
`--box`, but never touches github.com.

From the repository root:

```sh
bun --no-env-file install --ignore-scripts
# Install the dedicated browser once:
bun --no-env-file apps/sites-e2e/node_modules/playwright/cli.js install chromium

bun --no-env-file apps/sites-e2e/src/run.ts --repetitions 3
bun --no-env-file apps/sites-e2e/tests/processes.ts
bun --no-env-file apps/sites-e2e/tests/cleanup.ts
bun --no-env-file run --cwd apps/sites-e2e check-types
```

The runner uses Playwright's managed Chromium. Override with
`--executable /absolute/path/to/chromium`. Helium can also be supplied explicitly,
but it aborted sequential navigations intermittently in local verification, so
it is not the default. The harness never opens an existing
browser profile. The dependency installation occurs only in the current worktree.

## Coverage and boundaries

- Live blog/changelog/Markdown and MDX pages render; the Acme React counter and
  inline toggle hydrate and respond to clicks.
- Content: every builtin (five callout variants, columns/cards, accordion
  group, tabs, steps, code group, video, YouTube embed allowed by the CSP,
  site areas, theme toggle), global `style.css`/`script.js` under the CSP,
  header/footer/after-post slot with content variables, authors, blog and
  changelog tag pages, the changelog `Update` entry and the generated OG image.
- Mounted assets and their bytes, cache headers and ETags, root/manifest/slash
  redirects, HTML/Markdown/HEAD 404s, negotiated/direct Markdown twins, robots,
  sitemap index and area maps, feeds, LLMS files, canonical, OG and JSON-LD.
- Protected preview denies anonymous/incorrect-password/invalid-token access
  (401 without a cookie, for its pages and every non-HTML file: Markdown
  twins, LLMS files, feeds, sitemaps, `/_notra/assets/`, one file per
  extension in the build); password and signed share-link access work, the session is HttpOnly and signs
  out, and rendered previews have noindex/no-store and **zero** internal/external
  analytics scripts, provider events or ingest calls.
- A second, hand-made tenant (alias, custom domain and a stale alias left by
  a slug change) shares Acme's paths and one Acme content hash with its own
  bytes: each host serves only its own files, the edge cache never crosses
  sites, and stale/unknown hosts get the 404 page.
- Actual Notra traffic and engagement code (with an explicitly dispatched
  synthetic `pagehide` trigger) sends to a strict in-process ingest
  simulation: exactly one traffic and one engagement event per page view,
  for that page's URL; 404s are reported with their status, while assets,
  redirects, 304s and HEAD requests are not. Same-origin subresources must
  load (only the beacon aborted by the next navigation is allowed). The harness
  waits for requested site subresources, including lazy images and deferred
  island chunks, to finish and remain idle for 500 ms before navigating away.
  This wait ignores analytics beacons and unrelated vendor traffic and is
  outside the navigation and beacon measurements. The analytics
  integrations (Databuddy, GA4, Plausible, PostHog,
  Umami) come from the provider registry in `emulators/browser/`; their
  stand-in scripts' requests are asserted against synthetic IDs, `data-*`
  options, current URLs and event payloads, and every script and endpoint
  origin must be allowed by the page's `script-src`/`connect-src`. All other
  external requests fail the suite, except the YouTube embed and avatar images
  answered locally.
- `--vendor-scripts live` loads the vendors' **real** scripts from their CDNs
  instead (internet required). Each must report every page with the ID Notra
  rendered, through the site's CSP; collection requests are still answered
  locally, so nothing reaches a vendor. Every release runs this alongside the
  gate and alerts Slack when a vendor changes something Notra relies on; it
  never blocks the release.
- The analytics assertion regressions reject wrong IDs (including prefix
  matches), wrong hosts/pages/query strings, custom events, malformed payloads
  and IDs belonging to a different batched event. A real Chromium routing check
  verifies collection is answered locally and undeclared vendor paths are blocked.
  Registry parity makes a new product integration fail CI until it has an E2E provider.
- Parallel compiler regressions verify two suites can build against the same
  installed dependencies without sharing Vite's writable cache. Each Worker
  also allocates its own inspector port instead of competing for port 9229.

**The gate's provider tests verify the product's generated script URLs,
inline initialization, attributes, CSP and transport contracts against
stand-ins; the live vendor run covers real SDK behaviour. Neither establishes
vendor reception, attribution, consent, or analytics dashboard counts.** Local `workerd` matches
the Workers runtime, but not Cloudflare's network: edge-cache propagation across
locations, DNS/TLS and custom-hostname routing are not covered. The password
rate limiter is the real binding, exercised until it locks out guessing. Routing blocks all browser-originated external HTTP requests;
Chromium background services are disabled, but this is not an OS network sandbox.

## Benchmarks and artifacts

JSON is emitted on stdout; build diagnostics go to stderr. Optional explicit
outputs are the only retained run artifacts:

```sh
bun --no-env-file apps/sites-e2e/src/run.ts --repetitions 5 \
  --report /absolute/path/benchmarks.json --screenshot /absolute/path/live.png
```

The report includes every raw millisecond sample, count/min/median/p95/max,
commit/runtime/browser/OS/CPU metadata, fixture artifact counts/bytes/config
hashes, assertion inventory and cleanup results. Live and preview compile timings
have one sample each; navigation and navigation-to-simulated-provider-request
timings repeat on five pages, alongside synthetic-pagehide-to-actual-beacon
timings. This is a warm browser process with one new isolated
profile, HTTP caching disabled by request interception, and sequential navigations.
These timings are local harness measurements, **not vendor ingestion latency** or
production serving performance. There is no machine-independent performance budget.

## Failure and cleanup

An assertion or cleanup failure exits nonzero. `--timeout 300` bounds the run;
SIGINT/SIGTERM cancel it with exit 130, and a deadline exits 124. Cleanup closes the
browser/server, terminates the owned worker/compiler process group and surviving
known Chromium/Helium roots with the exact owned `--user-data-dir=<temp>/browser`
argument. An orphan's entire group is terminated only when that proven browser
root is its process-group leader; unrelated commands mentioning the temporary
path are never selected. Cleanup verifies the listener refuses connections,
then removes all compiler work/output, toolchain copy, profile and temporary
report/screenshot files. The fixture and production sources remain unchanged.
Executable identity is read from `/proc/<pid>/exe` on Linux or `proc_pidpath` on
macOS rather than trusting an arbitrary command-line substring. The process
regression verifies real orphan Chromium recovery while a separate command
mentioning the exact temporary profile remains alive.
macOS temporary paths are canonicalized before compilation to avoid Astro's
`/var` versus `/private/var` virtual-module mismatch.

`tests/cleanup.ts` runs the full passing suite, an intentional assertion failure
after browser startup, SIGINT with browser/server active, SIGTERM during compilation
and a compilation deadline. It independently checks removed directories and dead
process groups/profile-scoped processes. `--failure-probe` and `--hold-probe` are
only used by these lifecycle tests. Nothing is skipped or marked as a fake pass.

The lifecycle verifier requires POSIX process groups and `ps` (macOS/Linux).
SIGKILL of the supervisor, machine loss, and an OS crash cannot run `finally` or
signal handlers; those cases are outside the cleanup guarantee. No cloud resources
are created, so there is no cloud cleanup in this workspace.

## Keeping the suite green

The suite gates every production deploy (`production-deploy.yml` runs it on the
release commit with real Box builds), so a red run blocks the release. It
does not run on pull requests; run it locally (below) or start the workflow
on your branch (`gh workflow run sites-e2e.yml --ref <branch>`) before
merging a Sites change. Keep it in step with the product:

- **Behaviour changes update the tests in the same PR.** A new builtin, route,
  header, integration, setting or lifecycle step gets an assertion: content and
  rendering in `src/utils/content.ts` (with fixture content in
  `fixtures/site/`), serving and preview behaviour in `src/worker.ts`,
  analytics providers in `emulators/browser/providers/` + `fixtures/*.js`,
  server flows in `tests/connected-lifecycle-postgres.test.ts`, and a new
  external service as an emulator ([`emulators/README.md`](emulators/README.md)).
- **Visual changes must not break it.** Select by role and accessible name
  (`getByRole("tab", { name })`), fixture text, `<meta>`/`<link>` tags, and the
  public styling contract (stable IDs such as `#content-area`, `data-*`
  attributes). Never assert Tailwind classes, colours, spacing, DOM depth or
  exact HTML of the theme. If a spacing or colour change turns the suite red,
  the assertion was wrong: rewrite it against behaviour instead of updating it
  to the new markup.
- **Copy belongs to the fixture.** Assert text that comes from
  `apps/sites-builder/fixtures/acme` or `fixtures/site/`, not theme copy that a
  designer may reword. Product contracts (status codes, headers, CSP, robots,
  feeds, Markdown twins) are asserted exactly on purpose.
- **Keep it deterministic.** Wait for state (`waitForFunction`, roles becoming
  visible, island hydration) instead of sleeping, and keep every external
  request emulated (`emulators/`); an unexpected browser request or an
  unhandled emulator route fails the run.
- `fixtures/site/` is overlaid on the Acme fixture only in this harness, so
  adding content here never changes the builder's own tests.

Before merging a Sites change, run what you touched:

```sh
bun --no-env-file run sites:e2e                     # browser + content
bun --no-env-file run sites:e2e:dashboard --database-regressions   # server
UPSTASH_BOX_API_KEY=… bun --no-env-file run sites:e2e:dashboard --database-regressions --box
```

## Proving the suite catches regressions

A green run only shows nothing broke. `scripts/mutation-check.ts` shows the
suite would notice if something did: it puts one realistic bug at a time into
production code (`scripts/constants/mutations.ts`: an unsigned webhook
accepted, a redelivery processed twice, a rollback pin ignored, a leaked Box,
a domain verified without its TXT record, a missing CSP origin, a wrong
Databuddy ID, a preview without `noindex`, no password rate limit, …), runs
the suites that must catch it and restores the file. The unmutated code must
pass first; a bug that leaves a suite green is reported as a survivor and the
script exits nonzero.

```sh
SITES_TEST_ENABLED=true bun --no-env-file scripts/testing/dashboard/postgres.ts up   # note databaseUrl
SITES_TEST_ENABLED=true SITES_TEST_DATABASE_URL=… DATABASE_URL=… \
  bun --no-env-file scripts/testing/dashboard/migrate.ts
SITES_TEST_ENABLED=true SITES_TEST_DATABASE_URL=… \
  bun --no-env-file apps/sites-e2e/scripts/mutation-check.ts [--only id,id] [--report out.json]
```

When a test change weakens an assertion, run the mutations it covers; when a
new behaviour gets a test, add a mutation that breaks it.
