# Notra on omarchy

A persistent, self-hosted Notra dashboard and REST API in Docker on the omarchy
host. From any machine on the tailnet, open the dashboard at
https://omarchy.dwelf-stork.ts.net:3090 and call the API at
https://omarchy.dwelf-stork.ts.net:3091. The containers bind only to
127.0.0.1:3090 and 127.0.0.1:3091, and Tailscale Serve puts them on the tailnet
with HTTPS. Neither is on the public internet.

| Piece | Where |
| --- | --- |
| Checkout the instance runs from | `/home/evolv3ai/dev/notra` (branch `local/run`) |
| Compose file | `deploy/omarchy/compose.yaml` |
| Secrets | `/home/evolv3ai/firstmate-homes/vibe/data/notra-deploy/.env` (chmod 600, template: `.env.example`) |
| Boot | `docker.service` enabled at boot plus `restart: unless-stopped` |
| Tailnet access | `tailscale serve --bg --https=3090 http://127.0.0.1:3090` and the same for 3091 (persist across reboots) |
| Data | Docker volumes `notra_postgres-data`, `notra_redis-data`, `notra_workflow-data` |

## Services

- `dashboard`: the Next.js app (`apps/dashboard/Dockerfile`, standalone build).
- `api`: the public REST API (`apps/api/Dockerfile`, Bun). It authenticates
  `ntra_` keys through Unkey (see [Use the API](#use-the-api)).
- `migrate`: runs the drizzle migrations from the same image, then exits. The
  dashboard starts only after it succeeds.
- `postgres`: Postgres 16.
- `redis` and `redis-http`: Redis plus
  [serverless-redis-http](https://github.com/hiett/serverless-redis-http),
  which serves the Upstash REST API Notra expects.
- `redis-rest`: `redis-rest-shim.mjs`, in front of `redis-http`. It strips the
  Upstash-only Lua flag that `@upstash/ratelimit` sends (open-source Redis
  rejects it, which breaks sign-up) and serves `SUBSCRIBE` as server-sent
  events, which serverless-redis-http lacks and live chat streaming needs.

The compose file sets `NOTRA_SELF_HOSTED=true` on the dashboard and the api,
which skips Autumn billing gates while no `AUTUMN_SECRET_KEY` is set, and
`NEXT_PUBLIC_UNLIMITED_ORGANIZATIONS=true`.

## Commands

Run everything from `/home/evolv3ai/dev/notra` with this alias:

```bash
export NOTRA_ENV_FILE=/home/evolv3ai/firstmate-homes/vibe/data/notra-deploy/.env
alias notra='docker compose -p notra --env-file "$NOTRA_ENV_FILE" -f deploy/omarchy/compose.yaml'
```

| Task | Command |
| --- | --- |
| Start (builds the image the first time) | `notra up -d --build` |
| Stop | `notra stop` |
| Status | `notra ps` |
| Logs | `notra logs -f dashboard` (or `api`, `migrate`, `postgres`, `redis-http`) |
| Restart after an `.env` change | `notra up -d` |

`notra down` removes the containers but keeps the volumes. Never add `-v`
unless you mean to delete the database.

## Update to the latest local/run

```bash
cd /home/evolv3ai/dev/notra
git checkout local/run && git pull --ff-only
notra up -d --build
notra logs migrate   # should end with "[migrate] migrations applied"
```

The build takes several minutes and a lot of memory; the running instance keeps
serving until the new container replaces it.

## Back up and restore the database

```bash
mkdir -p ~/backups/notra
notra exec -T postgres pg_dump -U notra -d notra -Fc > ~/backups/notra/notra-$(date +%F).dump
```

Restore into the running stack (overwrites existing data):

```bash
notra stop dashboard
notra exec -T postgres pg_restore -U notra -d notra --clean --if-exists < ~/backups/notra/notra-YYYY-MM-DD.dump
notra start dashboard
```

To copy the raw volume instead, stop the stack first:
`docker run --rm -v notra_postgres-data:/data -v ~/backups/notra:/backup alpine tar czf /backup/postgres-data.tgz -C /data .`

## Start on boot

`docker.service` is enabled (`sudo systemctl enable docker.service`), so the
daemon starts at boot instead of waiting for socket activation, and every
long-running service has `restart: unless-stopped`. After a reboot the stack
comes back on its own unless you stopped it with `notra stop`; start it again
with `notra up -d`.

## Reach it from other machines

The app's public URL is `NOTRA_PUBLIC_URL` in the secrets file, currently
`https://omarchy.dwelf-stork.ts.net:3090`. Tailscale Serve terminates HTTPS with
the tailnet certificate and proxies to the loopback port:

```bash
tailscale serve --bg --https=3090 http://127.0.0.1:3090   # once; it persists
tailscale serve --bg --https=3091 http://127.0.0.1:3091   # the api
tailscale serve status                                     # should list both proxies, "tailnet only"
```

Serving over HTTPS matters: AuthKit sets secure session cookies, and browsers
restrict plain-HTTP origins other than localhost. Never use `tailscale funnel`
here, because that would publish the app to the internet.

## Use the API

The api serves Notra's public REST API (`/v1/posts` and the rest; the OpenAPI
schema is at `/openapi.json`) at https://omarchy.dwelf-stork.ts.net:3091.
Send an `ntra_` key as a bearer token:

```bash
curl -H "Authorization: Bearer $NOTRA_API_KEY" \
  https://omarchy.dwelf-stork.ts.net:3091/v1/me/workspaces
```

`POST /v1/posts` creates a draft unless the body sets `status`.

Keys are Unkey keys. The api checks each request with Unkey's `verifyKey` using
`UNKEY_ROOT_KEY`, and the key's `externalId` is the organization it acts on.
The dashboard's **API Keys** page uses `UNKEY_ROOT_KEY` and `UNKEY_API_ID` to
list, mint, and revoke keys. Both values come from the Unkey workspace that
minted the existing keys (the earlier Windows stack's), so those keys keep
working; a root key from any other workspace rejects them as invalid.

Every API request calls Unkey Cloud, so the api needs outbound internet access.
`GET /v1/status` is public and makes a quick reachability check.

## Known limits

- Features whose keys are unset stay off: GEO website discovery during
  onboarding needs `CONTEXT_DEV_API_KEY` (use **Skip this step**), email needs
  `RESEND_API_KEY` (the log shows `Resend API key not set`; nothing breaks),
  repository-based content needs the GitHub App.
- QStash schedules and webhooks call back to the app, so they need a public URL.
  Content you start from the dashboard does not; it runs in Vercel Workflow's
  local world inside the container. The api still requires `QSTASH_TOKEN` at
  boot.

## First login

Sign-in uses WorkOS AuthKit. The WorkOS environment must list
`<NOTRA_PUBLIC_URL>/auth/callback`
(`https://omarchy.dwelf-stork.ts.net:3090/auth/callback`) as a redirect URI and
have email and password authentication enabled. The WorkOS environment is the
same one the earlier local stack used, so existing accounts **log in**. A new
account chooses **Register** and enters the 6-digit code WorkOS emails.

A WorkOS staging environment ships a test organization that claims
`example.com` through SSO, so addresses on that domain get "Your organization
requires a different sign-in method".

If you change `NOTRA_API_PORT`, update its Tailscale Serve port too.

If you change `NOTRA_PORT` or `NOTRA_PUBLIC_URL`, update the WorkOS redirect URI
and the Tailscale Serve port, then rebuild with `notra up -d --build`:
`NEXT_PUBLIC_*` values are baked into the image.
