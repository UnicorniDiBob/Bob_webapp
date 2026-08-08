#!/usr/bin/env bash
# Ricostruisce lo schema di Bob dai soli file in supabase/migrations, su un
# Postgres vuoto, e ne stampa l'impronta. Serve a rispondere a una domanda
# sola: un clone nuovo del repo riproduce la produzione?
#
# Perche' non `supabase db diff`: il repo numera le migrazioni NNN_nome.sql, non
# col timestamp che la CLI si aspetta, e non c'e' supabase/config.toml. La CLI
# non riesce ad appaiare i file con la storia applicata, quindi il suo diff non
# e' utilizzabile. Questo script fa la stessa verifica per la strada che il repo
# ha davvero: rigioca i file in ordine e confronta il risultato.
#
# Uso:
#   ./scripts/schema_check.sh                 # ricostruisce e stampa l'impronta
#   ./scripts/schema_check.sh --fingerprint   # solo l'impronta, per il confronto
#
# Poi la stessa query (scripts/schema_fingerprint.sql) va eseguita sulla
# produzione: le otto righe devono coincidere, categoria per categoria.
#
# Richiede: postgresql-16 e postgresql-16-cron installati; gira come utente
# postgres. Su macOS: brew install postgresql@16 e adattare PGBIN.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PORT:-55432}"
WORK="${WORK:-/tmp/bob_schema_check}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$PGBIN:$PATH"
P="-h /tmp -p $PORT -U postgres"

mkdir -p "$WORK"
if [ ! -d "$WORK/pgdata" ]; then
  initdb -D "$WORK/pgdata" -U postgres -A trust >/dev/null
  cat >> "$WORK/pgdata/postgresql.conf" <<CONF
shared_preload_libraries = 'pg_cron'
cron.database_name = 'bobclone'
wal_level = logical
CONF
fi
pg_ctl -D "$WORK/pgdata" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$WORK/pg.log" restart -m fast >/dev/null 2>&1 || \
  pg_ctl -D "$WORK/pgdata" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$WORK/pg.log" start >/dev/null 2>&1
sleep 3

psql $P -d postgres -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='bobclone'" >/dev/null 2>&1 || true
dropdb $P --if-exists bobclone >/dev/null 2>&1 || true
createdb $P bobclone
psql $P -d postgres -q -c "alter database bobclone set search_path to public, extensions"
pg_ctl -D "$WORK/pgdata" -l "$WORK/pg.log" restart -m fast >/dev/null 2>&1; sleep 3

psql $P -d bobclone -q -v ON_ERROR_STOP=1 -f "$REPO/scripts/schema_shim.sql"
psql $P -d bobclone -q -v ON_ERROR_STOP=1 -f "$REPO/scripts/schema_shim_extensions.sql"

fail=0
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  if ! out=$(psql $P -d bobclone -v ON_ERROR_STOP=1 -q -f "$f" 2>&1); then
    echo "FAIL $(basename "$f"): $(echo "$out" | grep -m1 ERROR)"
    fail=$((fail+1))
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "RICOSTRUZIONE FALLITA: $fail file. Un clone nuovo NON riproduce la produzione."
  exit 1
fi
echo "Ricostruzione completata dai soli file del repo: 0 errori."
echo
psql $P -d bobclone -f "$REPO/scripts/schema_fingerprint.sql"
echo
echo "Ora esegui scripts/schema_fingerprint.sql sulla produzione e confronta le otto righe."
