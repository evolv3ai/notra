# Dashboard layout-shift checks

These checks exercise `apps/dashboard`, not the marketing website. They use a
disposable PostgreSQL database and the existing synthetic demo dataset. No
production credentials or customer data are required.

## Local setup

Install the repository's pinned Bun/Node dependencies, PostgreSQL 16 (binaries
under `/usr/lib/postgresql/16/bin`), and `agent-browser` with its browser runtime.
Run commands from the repository root. The setup script supports either an
unprivileged user or root with the PostgreSQL service account available.

```sh
bash scripts/performance/setup-dashboard.sh
```

This starts a loopback-only database on port 55432, verifies its data directory,
applies committed migrations, and creates a synthetic demo sandbox. It writes
the expiring session fixture to
`.hoplite/artifacts/layout-shift/dashboard-fixture.json` with mode 0600. Do not
commit or upload that file. Rerun setup when the fixture expires.

Build and start the dashboard in separate terminals using isolated environments:

```sh
cd apps/dashboard
env -i PATH="$PATH" HOME="$HOME" \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55432/notra_cls \
  NOTRA_DEMO_MODE=true NEXT_PUBLIC_NOTRA_DEMO_MODE=true \
  WORKOS_COOKIE_PASSWORD=local-layout-shift-fixture-password-2026 \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
  NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 \
  bun run build
```

```sh
cd apps/dashboard
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production \
  HOST=127.0.0.1 PORT=3000 \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55432/notra_cls \
  NOTRA_DEMO_MODE=true NEXT_PUBLIC_NOTRA_DEMO_MODE=true NOTRA_DEMO_POOL_SIZE=0 \
  WORKOS_COOKIE_PASSWORD=local-layout-shift-fixture-password-2026 \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
  NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 \
  node .output/server/index.mjs
```

The password above is deliberately synthetic and must only be used with this
disposable local database. The benchmark installs the fixture's cookie directly;
it does not exercise `/api/demo/enter`, WorkOS login, or external billing/AI
services. Do not enable authentication impersonation or expose this setup as a
publicly usable demo.

## Measurements

```sh
node scripts/performance/layout-shift.mjs http://127.0.0.1:3000 .hoplite/artifacts/layout-shift/cold-load 3
node scripts/performance/dashboard-transitions.mjs http://127.0.0.1:3000 .hoplite/artifacts/layout-shift/transitions 3
```

Arguments are the loopback base URL, output directory, and positive repetition
count. Use `127.0.0.1` to match the generated fixture cookie. Outputs include
JSON with individual shift sources and screenshots. Keep output directories
separate for baseline and candidate runs. For a baseline, run the same harness
against a build from the target revision using the same synthetic fixture and
viewport settings; never regenerate fixtures between compared runs.

- Cold loads cover 18 dashboard routes at 1440×900 and 390×844, with disabled
  and cleared browser caches and a six-second observation period per route.
- Mobile uses 4× CPU throttling; desktop uses 1×. Cold-load networking is
  unthrottled loopback networking.
- Transitions cover GEO overview, traffic, prompts, content, feedback, and brand
  identity with 200 ms network latency. Screenshots are sampled approximately
  300 ms after navigation and again after settling. A pending screenshot may
  show already-loaded content; its filename does not prove a skeleton appeared.
- Transition navigation uses TanStack Router directly, without a preceding user
  input, to avoid hiding shifts behind the recent-input exclusion. Transition
  frames track the original shell's DOM identity and connection throughout an
  elapsed six-second window; missing or replaced shells fail validation. Sampling
  starts before client navigation, not during initial document rendering.
  `pendingObserved` and `scenarioExercised` are true only when route skeletons
  appear in sampled frames. Fast navigation may pass with both false; it does not
  prove pending/skeleton coverage.
- CLS is the largest session-window score, excluding `hadRecentInput` entries.
  A gap of at least one second or a duration of at least five seconds starts a
  new window. `totalShift` includes all observed entries, including those excluded
  from CLS; individual entries retain `hadRecentInput` for separate analysis.
- The harness rejects expired fixture metadata, unexpected routes, missing
  dashboard shells, recognized error headings, unloaded fonts, remaining route
  skeletons inside `main`, and document horizontal overflow. A fixed observation
  window still does not prove every optional action or lazy dependency resolved.
  It is a measurement tool, not comprehensive functional coverage or a production
  performance assertion.

Use real clicks and keyboard interactions separately for navigation drawers,
collections, the editor, and search. Report their recent-input shifts separately
from CLS. Review screenshots and play any exported recording before sharing it.
An isolated local run, especially a single repetition, is not field data or a
statistical performance guarantee. The broad suite should use a production build;
the Vite development server can exhaust its heap when traversing every route.

## Integrated verification (2026-10-18)

Baseline: `main` at `f75cba1f90`. Candidate: PR #1778 integrated with that
revision and the server-rendered article-action fix. Both production builds used
Node 24.11.1, Bun 1.4.0, PostgreSQL 16, and the same disposable synthetic dataset.
No production credentials or customer data were used. Main's unconditional Jobs
sidebar is preserved; the superseded sidebar flag/provider is not restored.

The broad cold-load comparison sampled each of the 18 routes once per viewport
(72 document loads across baseline and candidate). These are diagnostic samples,
not field data or a statistical guarantee of zero dashboard-wide CLS.

| Observed cold-load CLS | Current main | Integrated candidate |
| --- | ---: | ---: |
| Content, desktop | 0.03155 | 0 |
| Content, mobile | 0.06573 | 0 |
| Maximum across 18 routes, desktop | 0.03719 | 0.01128 |
| Maximum across 18 routes, mobile | 0.06573 | 0.00464 |

Holding and releasing the real demo-chrome module moves the heading and main
content by 44 px on main, but 0 px on the candidate. The candidate reserves the
actual 44 px banner height before the lazy module arrives.

The article action now comes from the Content route loader rather than waiting
for client tracking settings or billing. Both a normal run and a run blocking
client billing retained the action from the first rendered Content actions
through hydration, with zero tracking-settings requests and mobile CLS 0.
Organization membership, project ownership, and generation billing checks remain
on the server; missing or denied availability does not expose the action.

Real mobile clicks at 800 ms latency exercised the article form, New post,
Generate content, collection, loaded editor, search, and sidebar navigation.
The collection/editor segment observed pending skeletons and preserved the
original shell. Editor CLS was 0; its 0.00017 recent-input shift was reported
separately. The article form loaded its project brand and became submittable
after a topic was entered; no AI generation or billing mutation was invoked.

The non-input transition harness also counts intentional route-layout changes.
In particular, desktop Brand Identity adds a 48 px breadcrumb bar and expands
the Workspace navigation group. Do not present that route-specific movement as
a lazy-loading fix or silently discard it from reported CLS.

Each version completed 36 transitions (six routes, three repetitions, both
viewports). Every run observed pending skeletons, completed loading, and retained
the original connected shell. Maximum transition CLS was 0.02848 desktop and
0.00018 mobile for both versions; the desktop maximum is Brand Identity's
existing route-layout change. GEO overview improved from 0.00663 to 0.

The subsequent main revision `68cba50a34` was also merged without conflicts. Its
changes are confined to sites categories, schemas, and documentation; the
dashboard/browser measurements above use the stated `f75cba1f90` baseline.

Small home, chat, and sidebar shifts remain. External demo entry, live billing/AI
services, and Redis-backed realtime are outside this isolated verification.
Synthetic cookie fixtures must never be included in shared evidence.
