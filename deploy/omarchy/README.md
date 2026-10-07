# Notra on omarchy

A persistent, self-hosted Notra dashboard in Docker on the omarchy host. It
serves http://localhost:3090 and binds only to 127.0.0.1.

| Piece | Where |
| --- | --- |
| Checkout the instance runs from | `/home/evolv3ai/dev/notra` (branch `local/run`) |
| Compose file | `deploy/omarchy/compose.yaml` |
| Secrets | `/home/evolv3ai/firstmate-homes/vibe/data/notra-deploy/.env` (chmod 600, template: `.env.example`) |
| Boot unit | `~/.config/systemd/user/notra.service` (user unit; lingering is on) |
| Data | Docker volumes `notra_postgres-data`, `notra_redis-data`, `notra_workflow-data` |

## Services

- `dashboard`: the Next.js app (`apps/dashboard/Dockerfile`, standalone build).
- `migrate`: runs the drizzle migrations from the same image, then exits. The
  dashboard starts only after it succeeds.
- `postgres`: Postgres 16.
- `redis` and `redis-http`: Redis plus
  [serverless-redis-http](https://github.com/hiett/serverless-redis-http),
  which serves the Upstash REST API Notra expects.

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

Docker on omarchy is socket-activated, so the daemon only starts when something
talks to it. The user unit below runs `up -d` at boot (lingering is enabled),
which starts the daemon and the stack; the `unless-stopped` restart policy keeps
the containers up afterwards.

```ini
# ~/.config/systemd/user/notra.service
[Unit]
Description=Notra self-hosted stack (docker compose)
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/evolv3ai/dev/notra
Environment=NOTRA_ENV_FILE=/home/evolv3ai/firstmate-homes/vibe/data/notra-deploy/.env
ExecStart=/usr/bin/docker compose -p notra --env-file ${NOTRA_ENV_FILE} -f deploy/omarchy/compose.yaml up -d
ExecStop=/usr/bin/docker compose -p notra --env-file ${NOTRA_ENV_FILE} -f deploy/omarchy/compose.yaml stop

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now notra.service
```

## First login

Sign-in uses WorkOS AuthKit. The WorkOS environment must list
`http://localhost:3090/auth/callback` as a redirect URI and have email and
password authentication enabled. Open http://localhost:3090, choose **Sign up**,
then create the first organization in onboarding.

If you change `NOTRA_PORT` or `NOTRA_PUBLIC_URL`, update the WorkOS redirect URI
and rebuild: `NEXT_PUBLIC_*` values are baked into the image.
