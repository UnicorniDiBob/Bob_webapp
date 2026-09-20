#!/usr/bin/env bash
# CONTROLLO DI DERIVA — il repo e la produzione sono la stessa cosa?
#
# PERCHE' ESISTE (20/09). Le due volte in cui questo progetto ha perso qualcosa
# non se n'e' accorto nessuno per giorni, e sempre per lo stesso motivo: niente
# confronta il repo con la produzione. La 056 e' vissuta sei giorni senza file.
# La 089 ha riportato indietro tre migrazioni dentro professionals_score, e l'ho
# trovata per caso quattro giorni dopo. La 093 e' online come CODICE dal 18/09 e
# non e' mai stata applicata come SCHEMA: i cinque «-altro» dei servizi core non
# fanno nessuna domanda al cliente, e lo si scopre solo guardando.
#
# Il pezzo che mancava non era lo strumento — schema_check.sh esiste da un mese —
# era ESEGUIRLO. Questo script mette insieme le due meta' e si puo' dare a un
# cron, a un giro notturno o a un rito del giovedi'.
#
# RISPONDE A DUE DOMANDE SEPARATE, e la prima e' piu' importante della seconda:
#
#   1) MIGRAZIONI. Quali file del repo NON sono applicati in produzione, e quali
#      migrazioni applicate non hanno un file. Un file non applicato e' codice
#      online che gira su uno schema che non c'e'.
#
#   2) SCHEMA. Ricostruisce il database da zero dai soli file del repo e
#      confronta le otto righe dell'impronta con la produzione. Le migrazioni
#      non ancora applicate vengono ESCLUSE dalla ricostruzione: se no la
#      differenza sarebbe legittima, il controllo griderebbe sempre al lupo e
#      dopo due settimane non lo guarderebbe piu' nessuno.
#
# USO
#   PGURL='postgresql://...' ./scripts/deriva.sh    confronto completo
#   ./scripts/deriva.sh                             solo il lato repo
#
# Esce 1 se trova una differenza: cosi' si puo' appendere a una CI.
# Richiede quello che richiede schema_check.sh (postgresql-16 + pg_cron, utente
# postgres) piu' psql per parlare con la produzione. Non scrive NIENTE in
# produzione: legge e basta.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${WORK:-/tmp/bob_deriva}"
PGURL="${PGURL:-}"
rc=0

mkdir -p "$WORK"

echo "=== 1) MIGRAZIONI ==="
ls "$REPO"/supabase/migrations/*.sql | xargs -n1 basename | cut -c1-3 | sort -u > "$WORK/numeri_repo.txt"

if [ -z "$PGURL" ]; then
  echo "PGURL non impostata: salto il confronto con la produzione."
  echo "Nel repo ci sono $(wc -l < "$WORK/numeri_repo.txt") numeri di migrazione, dal $(head -1 "$WORK/numeri_repo.txt") al $(tail -1 "$WORK/numeri_repo.txt")."
else
  psql "$PGURL" -Atq -c \
    "select name from supabase_migrations.schema_migrations order by version" \
    | cut -c1-3 | sort -u > "$WORK/numeri_prod.txt"

  mancanti="$(comm -23 "$WORK/numeri_repo.txt" "$WORK/numeri_prod.txt" | tr '\n' ' ')"
  orfane="$(comm -13 "$WORK/numeri_repo.txt" "$WORK/numeri_prod.txt" | tr '\n' ' ')"

  if [ -n "$mancanti" ]; then
    echo "NEL REPO MA NON APPLICATE: $mancanti"
    echo "  (se il codice che ne dipende e' gia' su main, la produzione sta girando senza)"
    rc=1
  fi
  if [ -n "$orfane" ]; then
    echo "APPLICATE SENZA FILE NEL REPO: $orfane"
    echo "  (e' il caso della 056: lo schema vive solo in produzione)"
    rc=1
  fi
  [ -z "$mancanti$orfane" ] && echo "Allineate: stessi numeri nel repo e in produzione."
fi

echo
echo "=== 2) SCHEMA ==="

if [ -z "$PGURL" ]; then
  echo "Senza PGURL ricostruisco e basta: l'impronta va confrontata a mano."
  "$REPO/scripts/schema_check.sh"
  exit $rc
fi

# La ricostruzione deve contenere SOLO cio' che e' applicato: si lavora su una
# copia, il repo non si tocca.
rm -rf "$WORK/repo"
cp -R "$REPO" "$WORK/repo"
rm -rf "$WORK/repo/.git" "$WORK/repo/node_modules"
for f in "$WORK/repo"/supabase/migrations/*.sql; do
  n="$(basename "$f" | cut -c1-3)"
  grep -qx "$n" "$WORK/numeri_prod.txt" || { echo "  escludo $(basename "$f"): non applicata"; rm -f "$f"; }
done

WORK="$WORK/pg" "$WORK/repo/scripts/schema_check.sh" > "$WORK/ricostruzione.txt" 2>&1 || {
  echo "RICOSTRUZIONE FALLITA — un clone nuovo del repo non riproduce la produzione:"
  tail -20 "$WORK/ricostruzione.txt"
  exit 1
}

grep -E '^ (columns|constraints|event_triggers|functions|indexes|policies|tables|triggers)' \
  "$WORK/ricostruzione.txt" | tr -s ' ' | sed 's/^ //' | sort > "$WORK/impronta_repo.txt"

psql "$PGURL" -Atq -F'|' -f "$REPO/scripts/schema_fingerprint.sql" \
  | tr '|' ' ' | tr -s ' ' | sort > "$WORK/impronta_prod.txt"

if diff -u "$WORK/impronta_repo.txt" "$WORK/impronta_prod.txt" > "$WORK/diff.txt"; then
  echo "Le otto righe coincidono: la produzione e' quello che dicono i file."
else
  echo "IMPRONTE DIVERSE (- repo, + produzione):"
  cat "$WORK/diff.txt"
  echo
  echo "Per capire QUALE oggetto e' cambiato, ripeti la query di scripts/schema_fingerprint.sql"
  echo "sui due lati senza l'aggregazione finale (le righe 'sig') e diffa quelle."
  rc=1
fi

exit $rc
