# Notra on omarchy

A persistent, self-hosted Notra dashboard in Docker on the omarchy host. It
serves http://localhost:3090 and binds only to 127.0.0.1.

| Piece | Where |
| --- | --- |
| Checkout the instance runs from | `/home/evolv3ai/dev/notra` (branch `local/run`) |
| Compose file | `deploy/omarchy/compose.yaml` |
| Secrets | `/home/evolv3ai/firstmate-homes/vibe/data/notra-deploy/.env` (chmod 600, template: `.env.example`) |
| Boot | `docker.service` enabled at boot plus `restart: unless-stopped` |
| Data | Docker volumes `notra_postgres-data`, `notra_redis-data`, `notra_workflow-data` |

## Services

- `dashboard`: the Next.js app (`apps/dashboard/Dockerfile`, standalone build).
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

The compose file sets `NOTRA_SELF_HOSTED=true`, which skips Autumn billing
gates while no `AUTUMN_SECRET_KEY` is set, and
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
| Logs | `notra logs -f dashboard` (or `migrate`, `postgres`, `redis-http`) |
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

## Known limits

- Features whose keys are unset stay off: GEO website discovery during
  onboarding needs `CONTEXT_DEV_API_KEY` (use **Skip this step**), email needs
  `RESEND_API_KEY` (the log shows `Resend API key not set`; nothing breaks),
  repository-based content needs the GitHub App.
- QStash schedules and webhooks call back to the app, so they need a public URL.
  Content you start from the dashboard does not; it runs in Vercel Workflow's
  local world inside the container.

## First login

Sign-in uses WorkOS AuthKit. The WorkOS environment must list
`http://localhost:3090/auth/callback` as a redirect URI and have email and
password authentication enabled. Open http://localhost:3090, choose
**Register**, enter the 6-digit code WorkOS emails you, then create the first
organization in onboarding.

A WorkOS staging environment ships a test organization that claims
`example.com` through SSO, so addresses on that domain get "Your organization
requires a different sign-in method".

If you change `NOTRA_PORT` or `NOTRA_PUBLIC_URL`, update the WorkOS redirect URI
and rebuild: `NEXT_PUBLIC_*` values are baked into the image.
