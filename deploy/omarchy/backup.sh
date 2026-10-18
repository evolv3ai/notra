#!/usr/bin/env bash
# Nightly read-only pg_dump of Notra's database, keeping the newest 14 dumps.
# Runs pg_dump inside the notra postgres container; credentials stay in the
# stack's env file and are never printed.
set -euo pipefail

NOTRA_DIR="${NOTRA_DIR:-/home/evolv3ai/dev/notra}"
NOTRA_ENV_FILE="${NOTRA_ENV_FILE:-/home/evolv3ai/firstmate-homes/vibe/data/notra-deploy/.env}"
BACKUP_DIR="${NOTRA_BACKUP_DIR:-/home/evolv3ai/backups/notra}"
KEEP="${NOTRA_BACKUP_KEEP:-14}"

fail() {
  echo "notra-backup: ERROR: $*" >&2
  exit 1
}

[ -r "$NOTRA_ENV_FILE" ] || fail "env file not readable: $NOTRA_ENV_FILE"
[ -f "$NOTRA_DIR/deploy/omarchy/compose.yaml" ] || fail "compose file missing under $NOTRA_DIR"

umask 077
mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y-%m-%dT%H%M%S)"
target="$BACKUP_DIR/notra-$stamp.dump"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

docker compose -p notra --env-file "$NOTRA_ENV_FILE" \
  -f "$NOTRA_DIR/deploy/omarchy/compose.yaml" \
  exec -T postgres pg_dump -U notra -d notra -Fc >"$partial" ||
  fail "pg_dump failed"

[ -s "$partial" ] || fail "pg_dump produced an empty file"
mv "$partial" "$target"
echo "notra-backup: wrote $target ($(stat -c %s "$target") bytes)"

# Prune by name pattern only: keep the newest $KEEP notra-*.dump files.
mapfile -t dumps < <(find "$BACKUP_DIR" -maxdepth 1 -type f \
  -name 'notra-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9].dump' |
  sort -r)
for old in "${dumps[@]:$KEEP}"; do
  rm -f -- "$old"
  echo "notra-backup: pruned $old"
done
