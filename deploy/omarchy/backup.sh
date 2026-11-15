#!/usr/bin/env bash
# Nightly read-only pg_dump of Notra's database, keeping the newest 14 dumps,
# then a best-effort copy to an rclone remote that also keeps the newest 14.
# Runs pg_dump inside the notra postgres container; credentials stay in the
# stack's env file and are never printed.
set -euo pipefail

NOTRA_DIR="${NOTRA_DIR:-/home/evolv3ai/dev/notra}"
NOTRA_ENV_FILE="${NOTRA_ENV_FILE:-/home/evolv3ai/firstmate-homes/vibe/data/notra-deploy/.env}"
BACKUP_DIR="${NOTRA_BACKUP_DIR:-/home/evolv3ai/backups/notra}"
KEEP="${NOTRA_BACKUP_KEEP:-14}"
# Empty disables the off-host copy.
REMOTE="${NOTRA_BACKUP_REMOTE-dropbox:06_AI/backups/notra}"
UPLOAD_TIMEOUT="${NOTRA_BACKUP_UPLOAD_TIMEOUT:-15m}"
DUMP_NAME_GLOB='notra-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9].dump'
DUMP_NAME_REGEX='^notra-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}[.]dump$'

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
  -name "$DUMP_NAME_GLOB" |
  sort -r)
for old in "${dumps[@]:$KEEP}"; do
  rm -f -- "$old"
  echo "notra-backup: pruned $old"
done

# Off-host copy. A failure here is logged as a warning and never fails the
# local backup, which has already succeeded.
upload_offsite() {
  timeout "$UPLOAD_TIMEOUT" rclone copyto --quiet "$target" "$REMOTE/$(basename "$target")" ||
    return 1
  echo "notra-backup: copied to $REMOTE/$(basename "$target")"

  local remote_dumps
  remote_dumps="$(timeout "$UPLOAD_TIMEOUT" rclone lsf --files-only "$REMOTE")" || return 1
  mapfile -t remote_old < <(grep -E "$DUMP_NAME_REGEX" <<<"$remote_dumps" | sort -r | tail -n +"$((KEEP + 1))")
  for old in "${remote_old[@]}"; do
    timeout "$UPLOAD_TIMEOUT" rclone deletefile "$REMOTE/$old" || return 1
    echo "notra-backup: pruned $REMOTE/$old"
  done
}

if [ -n "$REMOTE" ]; then
  upload_offsite || echo "notra-backup: WARNING: off-host copy to $REMOTE failed; local backup is fine" >&2
fi
