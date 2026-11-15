#!/usr/bin/env bash
# Test-restore a Notra backup into a throwaway Postgres container and compare
# per-table row counts with the live database. The live database is only read,
# in a read-only transaction; the throwaway container has no network and no
# volume and is removed on exit.
#
# Usage: restore-test.sh [dump]   (default: the newest dump in the backup dir)
set -euo pipefail

NOTRA_DIR="${NOTRA_DIR:-/home/evolv3ai/dev/notra}"
NOTRA_ENV_FILE="${NOTRA_ENV_FILE:-/home/evolv3ai/firstmate-homes/vibe/data/notra-deploy/.env}"
BACKUP_DIR="${NOTRA_BACKUP_DIR:-/home/evolv3ai/backups/notra}"
IMAGE="${NOTRA_RESTORE_IMAGE:-postgres:16-alpine}"
READY_TIMEOUT_SECONDS=60

fail() {
  echo "notra-restore-test: ERROR: $*" >&2
  exit 1
}

dump="${1:-}"
if [ -z "$dump" ]; then
  dump="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'notra-*.dump' | sort -r | head -n 1)"
fi
[ -n "$dump" ] && [ -r "$dump" ] || fail "no readable dump (looked in $BACKUP_DIR)"
[ -r "$NOTRA_ENV_FILE" ] || fail "env file not readable: $NOTRA_ENV_FILE"
echo "notra-restore-test: dump $dump ($(stat -c %s "$dump") bytes)"

# Count every base table outside the system schemas, one "schema.table|count"
# line per table, sorted by name.
COUNT_SQL="select table_schema || '.' || table_name || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I',
    table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_type = 'BASE TABLE'
  and table_schema not in ('pg_catalog', 'information_schema')
order by 1"

container="notra-restore-test-$$"
work="$(mktemp -d)"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

docker run -d --rm --name "$container" --network none \
  -e POSTGRES_USER=notra -e POSTGRES_DB=postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$IMAGE" >/dev/null || fail "could not start $IMAGE"

for _ in $(seq "$READY_TIMEOUT_SECONDS"); do
  # The entrypoint restarts the server after init, so wait for a real query.
  if docker exec "$container" psql -U notra -d postgres -Atc 'select 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$container" psql -U notra -d postgres -Atc 'select 1' >/dev/null 2>&1 ||
  fail "throwaway postgres did not become ready"

docker exec "$container" createdb -U notra notra_restore_test ||
  fail "createdb failed"
docker exec -i "$container" pg_restore -U notra -d notra_restore_test \
  --no-owner --no-privileges --exit-on-error <"$dump" ||
  fail "pg_restore failed"

docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U notra \
  -d notra_restore_test -Atc "$COUNT_SQL" >"$work/restored" ||
  fail "counting restored rows failed"

docker compose -p notra --env-file "$NOTRA_ENV_FILE" \
  -f "$NOTRA_DIR/deploy/omarchy/compose.yaml" \
  exec -T -e PGOPTIONS='-c default_transaction_read_only=on' postgres \
  psql -X -v ON_ERROR_STOP=1 -U notra -d notra -Atc "$COUNT_SQL" >"$work/live" ||
  fail "counting live rows failed"

# Rows written after the dump make live counts higher; that is expected. A
# table missing from the restore is a failure.
missing=0
changed=0
equal=0
printf '%-55s %10s %10s\n' TABLE RESTORED LIVE
while IFS='|' read -r table live_count; do
  restored_count="$(awk -F'|' -v t="$table" '$1 == t { print $2 }' "$work/restored")"
  if [ -z "$restored_count" ]; then
    missing=$((missing + 1))
    printf '%-55s %10s %10s  MISSING\n' "$table" - "$live_count"
  elif [ "$restored_count" != "$live_count" ]; then
    changed=$((changed + 1))
    printf '%-55s %10s %10s  differs\n' "$table" "$restored_count" "$live_count"
  else
    equal=$((equal + 1))
    printf '%-55s %10s %10s\n' "$table" "$restored_count" "$live_count"
  fi
done <"$work/live"

echo "notra-restore-test: $equal tables equal, $changed differ (rows changed since the dump), $missing missing"
[ "$missing" -eq 0 ] || fail "$missing live tables are missing from the restore"
echo "notra-restore-test: OK"
