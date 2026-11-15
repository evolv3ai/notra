# Sites emulators

Every external service the Sites backend and sites talk to, emulated on
loopback so the production clients run unchanged. The backend reaches them
through the overrides in
[`packages/sites-server/src/utils/provider-urls.ts`](../../../packages/sites-server/src/utils/provider-urls.ts)
(`GITHUB_API_URL` for GitHub); production leaves those variables unset.

| Emulator | Serves | State and behaviour |
| --- | --- | --- |
| `github/` | REST, GraphQL, App auth, webhooks | [vercel-labs/emulate](https://github.com/vercel-labs/emulate) plus a proxy for tarballs (a 302 to a one-time codeload-style URL, as GitHub does), `createCommitOnBranch`, branch rules and full branch commits |
| `r2/` | R2's S3 API (path style) | Conditional writes (412), ListObjectsV2 pages (25 per page to exercise pagination), DeleteObjects, `aws-chunked` bodies; `binding()` is the Worker's R2 view of the same objects |
| `box/` | Upstash Box API | The snapshot is this checkout's staged builder toolchain; a box is a local directory for `/workspace/home`; `exec` runs the guest build there. `boxes` keeps every box with its `deleted` flag; `failNext` makes the next creations answer an error status (503 by default). Network isolation is not emulated |
| `cloudflare/` | Cloudflare for SaaS custom hostnames | A hostname turns active once the shared DNS zone has its CNAME to the SaaS target and Cloudflare's ownership TXT |
| `autumn/` | Autumn customer API | `customers.get_or_create` with the secret key checked; a new customer is on the `free` plan until the test attaches another with `setPlan`. Reached through `AUTUMN_API_URL` (the shared Autumn client in `packages/ai`) |
| `vercel/` | Vercel DNS integration | OAuth code exchange (checks client, secret, redirect URI), DNS records written into the shared zone, installation removal |
| `dns/` | UDP DNS (A, CNAME, NS, TXT) | Answers from the shared zone; reached through `SITES_DNS_SERVERS` |
| `browser/` | Analytics scripts, embeds, c15t consent backend | Provider registry: stand-in scripts with exact payload checks, or the vendors' real scripts with `--vendor-scripts live`. The consent backend answers `/init` with c15t's EU opt-in policy and records every saved choice |

`startSitesEmulators()` (`index.ts`) starts the server-side ones, returns the
environment that points the backend at them and `summaries()`: the routes each
served and every request no route matched. The lifecycle test records the
summaries in its journal (shown in the job summary) and fails on any
unhandled request, so product code that starts calling a new endpoint shows up
as a red run naming that endpoint.

Not emulated, on purpose:

- AI name moderation: the AI Gateway's evaluation protocol is proprietary;
  the lifecycle stubs `moderateSiteName`.
- Proxy-mode custom domains and Domain Connect settings: both are fetched with
  `fetchPublicUrl`, which refuses private addresses by design (SSRF guard).
  Domain Connect discovery still runs against the DNS emulator.
- Cloudflare's edge, TLS and cache propagation.

## Adding an emulator

1. Create `emulators/<service>/index.ts` exporting `start<Service>Emulator`.
   Build it on `startEmulator(name, routes)` from `core/service.ts`: routes
   are `{ method, path: "/v1/things/:id", handle }`; throw `EmulatorError` for
   API errors. Model the provider's real semantics (auth, conflicts, state
   transitions), not just happy-path responses, and return the `env` that
   points the backend at it.
2. Give the backend an override in `provider-urls.ts` (and add the variable to
   `turbo.json#globalEnv`); never change production defaults.
3. Register it in `index.ts` and use it from the lifecycle test.

## Adding an analytics provider

Add `browser/providers/<name>.ts` (settings, CDN script URL, stand-in file,
collection endpoint, live collection matcher, the identifier the vendor must
send, and the exact stand-in payload check), its stand-in script in
`apps/sites-e2e/fixtures/`, and list it in `ANALYTICS_PROVIDERS`. The fixture
site enables it, and the browser suite checks its script, CSP and payloads on
every page and in the live vendor run of every release.
