#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
pg_bin=/usr/lib/postgresql/16/bin
pg_data=/tmp/notra-cls-pg
pg_socket=/tmp/notra-cls-pg-socket
database_url=postgresql://postgres@127.0.0.1:55432/notra_cls
bun_bin="$(command -v bun)"

for executable in postgres initdb pg_ctl pg_isready psql createdb; do
  if [[ ! -x "$pg_bin/$executable" ]]; then
    printf 'PostgreSQL 16 executable is required: %s\n' "$pg_bin/$executable" >&2
    exit 1
  fi
done

pg_user="$(id -un)"
pg_command=()
if [[ "$(id -u)" -eq 0 ]]; then
  command -v runuser >/dev/null
  id postgres >/dev/null
  pg_user=postgres
  pg_command=(runuser -u postgres --)
fi

if [[ ! -d "$pg_data" ]]; then
  install -d -m 700 -o "$pg_user" "$pg_data"
fi
if [[ ! -f "$pg_data/PG_VERSION" ]]; then
  "${pg_command[@]}" "$pg_bin/initdb" -D "$pg_data" -U postgres -A trust --no-locale --encoding=UTF8 >/dev/null
fi
if [[ "$(cat "$pg_data/PG_VERSION")" != 16 ]]; then
  printf 'Refusing to use a non-PostgreSQL-16 data directory: %s\n' "$pg_data" >&2
  exit 1
fi

if ! "${pg_command[@]}" "$pg_bin/pg_ctl" -D "$pg_data" status >/dev/null 2>&1; then
  if "$pg_bin/pg_isready" -h 127.0.0.1 -p 55432 >/dev/null 2>&1; then
    printf 'Port 55432 is occupied by a different PostgreSQL instance; refusing to modify it.\n' >&2
    exit 1
  fi
  install -d -m 700 -o "$pg_user" "$pg_socket"
  "${pg_command[@]}" "$pg_bin/pg_ctl" -D "$pg_data" -l "$pg_data/server.log" \
    -o "-h 127.0.0.1 -p 55432 -k $pg_socket" -w start
fi

local_env=(env -i "PATH=$PATH" "HOME=$HOME" "DATABASE_URL=$database_url")
actual_data="$("${local_env[@]}" "$pg_bin/psql" -X -w -h 127.0.0.1 -p 55432 -U postgres -d postgres -Atc 'SHOW data_directory')"
if [[ "$actual_data" != "$pg_data" ]]; then
  printf 'Refusing to modify an unexpected PostgreSQL data directory: %s\n' "$actual_data" >&2
  exit 1
fi
if [[ "$("${local_env[@]}" "$pg_bin/psql" -X -w -h 127.0.0.1 -p 55432 -U postgres -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = 'notra_cls'")" != 1 ]]; then
  "${local_env[@]}" "$pg_bin/createdb" -w -h 127.0.0.1 -p 55432 -U postgres notra_cls
fi

cd "$repo_root"
"${local_env[@]}" "$bun_bin" --no-env-file packages/db/src/scripts/migrate.ts packages/db/migrations
"${local_env[@]}" NOTRA_DEMO_MODE=true NEXT_PUBLIC_NOTRA_DEMO_MODE=true \
  WORKOS_COOKIE_PASSWORD=local-layout-shift-fixture-password-2026 \
  "$bun_bin" --no-env-file apps/dashboard/scripts/layout-shift-fixture.ts
printf 'Local synthetic dashboard setup ready for http://127.0.0.1:3000 (app not started).\n'
