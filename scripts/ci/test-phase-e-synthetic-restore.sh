#!/usr/bin/env bash
# Synthetic-only backup -> isolated restore. No real Supabase connection.
set -euo pipefail
if [[ "${PGHOST:-}" != "127.0.0.1" || "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "ca_master_safety" || "${PGUSER:-}" != "postgres" ]]; then
 echo "STOP: expected isolated synthetic DB host/port/user/database" >&2
 exit 4
fi
if [[ -n "${DATABASE_URL:-}" || -n "${SUPABASE_DB_URL:-}" ||
      -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
 echo "STOP: refusing unexpected database routing" >&2
 exit 4
fi
source_db="ca_master_safety"
restore_db="ca_master_restore_qa"
verify_source="$(psql -X -A -t -v ON_ERROR_STOP=1 -d "$source_db" \
  -c "SELECT current_database()||'|'||host(inet_server_addr())")"
if [[ "$verify_source" != "ca_master_safety|127.0.0.1" ]]; then
 echo "STOP: synthetic source mismatch" >&2
 exit 4
fi
exists="$(psql -X -A -t -v ON_ERROR_STOP=1 -d postgres \
  -c "SELECT count(*) FROM pg_database WHERE datname='ca_master_restore_qa'")"
if [[ "$exists" != "0" ]]; then
 echo "STOP: restore target already exists, refusing overwrite" >&2
 exit 4
fi
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
psql -X -v ON_ERROR_STOP=1 -d "$source_db" \
 -f scripts/ci/phase-e-synthetic-restore-fixture.sql >/dev/null
pg_dump --format=custom --no-owner --no-acl --dbname="$source_db" \
 --file="$temp_dir/source.pgdump"
pg_restore --list "$temp_dir/source.pgdump" > "$temp_dir/catalog.txt"
(cd "$temp_dir" && sha256sum source.pgdump > manifest.sha256 && sha256sum --check manifest.sha256 >/dev/null)
createdb --maintenance-db=postgres --template=template0 "$restore_db"
pg_restore --no-owner --no-acl --exit-on-error \
 --dbname="$restore_db" "$temp_dir/source.pgdump"
verify_restore="$(psql -X -A -t -v ON_ERROR_STOP=1 -d "$restore_db" \
 -c "SELECT current_database()||'|'||host(inet_server_addr())")"
if [[ "$verify_restore" != "ca_master_restore_qa|127.0.0.1" ]]; then
 echo "STOP: restored test database mismatch" >&2
 exit 4
fi
tables=(
 auth.users:7 auth.identities:7 public.profiles:7
 public.ca_members:200 public.communities:155 public.community_ca_members:196
 public.user_ca_identities:7 public.stamp_collections:14
 public.stamp_collection_designs:14 public.stamp_exchange_sessions:20
 public.sync_automation_state:1 storage.objects:418
)
for entry in "${tables[@]}"; do
 table="${entry%%:*}"
 expected="${entry##*:}"
 query="SELECT to_jsonb(t)::text FROM $table t ORDER BY to_jsonb(t)::text"
 actual_source="$(psql -X -A -t -v ON_ERROR_STOP=1 -d "$source_db" -c "SELECT count(*) FROM $table")"
 actual_restore="$(psql -X -A -t -v ON_ERROR_STOP=1 -d "$restore_db" -c "SELECT count(*) FROM $table")"
 if [[ "$actual_source" != "$expected" || "$actual_restore" != "$expected" ]]; then
   echo "STOP: restore count mismatch for $table" >&2
   exit 5
 fi
 hash_source="$(psql -X -A -t -v ON_ERROR_STOP=1 -d "$source_db" -c "$query" | sha256sum | cut -d' ' -f1)"
 hash_restore="$(psql -X -A -t -v ON_ERROR_STOP=1 -d "$restore_db" -c "$query" | sha256sum | cut -d' ' -f1)"
 if [[ "$hash_source" != "$hash_restore" ]]; then
   echo "STOP: restored content mismatch for $table" >&2
   exit 5
 fi
 echo "PASS: restored synthetic $table; count $expected; SHA256 content equal"
done
psql -X -v ON_ERROR_STOP=1 -d "$restore_db" \
 -f scripts/ci/phase-e-restored-negatives.sql
echo "PHASE_E_SYNTHETIC_RESTORE_PASS: isolated DB content and protective stop verified"
