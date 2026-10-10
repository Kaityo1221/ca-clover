#!/usr/bin/env bash
# Disposable synthetic restore drill only. NEVER point this script at production.
set -euo pipefail
if [[ "${PGDATABASE:-}" != "ca_clover_http_qa" || "${PGHOST:-}" != "127.0.0.1" ]]; then
  echo "STOP: synthetic fixture only (PGDATABASE/PGHOST guard)" >&2
  exit 3
fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# Fixed fake source database, no --db-url and no real credentials.
pg_dump --no-owner --no-acl --format=custom --file="$tmp/synthetic.dump" "$PGDATABASE"
createdb ca_clover_restore_qa
pg_restore --no-owner --no-acl --exit-on-error --dbname=ca_clover_restore_qa "$tmp/synthetic.dump"
tables=(sync_automation_state ca_members communities user_ca_identities stamp_collections)
for t in "${tables[@]}"; do
  before="$(psql -AtX -d ca_clover_http_qa -c "select md5(coalesce(string_agg(to_jsonb(x)::text,E'\\n' order by to_jsonb(x)::text),'')) from public.$t x")"
  after="$(psql -AtX -d ca_clover_restore_qa -c "select md5(coalesce(string_agg(to_jsonb(x)::text,E'\\n' order by to_jsonb(x)::text),'')) from public.$t x")"
  if [[ "$before" != "$after" || -z "$after" ]]; then
    echo "STOP: synthetic restore mismatch: $t" >&2
    exit 4
  fi
  echo "PASS: synthetic restore $t"
done
# A restorable DB snapshot is not equivalent to Auth or Storage object bytes.
echo "PASS: synthetic pg_dump/pg_restore and row-content equality (five tables)"
