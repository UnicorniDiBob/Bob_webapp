#!/usr/bin/env python3
"""L'elenco dei comuni italiani con CAP e coordinate, per l'iscrizione.

PERCHÉ ESISTE
All'iscrizione il professionista dice dove ha la sua base: comune, provincia,
regione e CAP. Comune e regione si scelgono da una lista, non si scrivono — un
campo libero produce «milano», «Milano (MI)», «MILANO» e nessuno dei tre si può
confrontare con niente. Il CAP è obbligatorio e va suggerito a partire dal
comune: chi sta a Sesto San Giovanni ha un CAP solo, chi sta a Milano ne ha
quarantotto e deve poter scegliere il suo.

LE FONTI, E IL LORO STATO
- I comuni (nome, codice ISTAT, provincia, regione, sigla) vengono
  dall'archivio ISTAT attraverso matteocontrini/comuni-json, rilasciati in
  CC BY 3.0 IT: attribuzione dovuta, ed è scritta nel file generato.
- I CAP arrivano dalla stessa raccolta, che li dichiara presi «da varie fonti»
  e NON applica alcuna licenza, perché l'elenco ufficiale completo è di Poste
  Italiane e non è aperto. Sono quindi un aiuto alla compilazione, non una
  verità: il modulo li propone, non li impone, e un CAP fuori elenco si può
  comunque salvare. Scelta presa il 17/09/2026, scritta in
  docs/NOTE_E_DECISIONI.md.
- Le coordinate del comune vengono da un secondo elenco appaiato sul codice
  ISTAT, e servono a inquadrare la mappa dell'area di lavoro sul posto giusto
  invece che sul centro di Milano.

COSA PRODUCE
1. src/lib/data/comuni-italia.json, che NON viene mai importato da un
   componente del browser: lo legge solo /api/geo/comuni, lato server. Sono
   7.900 comuni: nel pacchetto del browser sarebbero quasi un megabyte per un
   campo di ricerca.
2. supabase/migrations/086_comuni_italia.sql, la stessa roba in database. Serve
   li' perche' la copertura del professionista si calcola lato server — «quali
   comuni cadono nel mio raggio» e' una query, non un giro di JavaScript — ed e'
   la ragione per cui i due file escono dalla stessa passata: due elenchi della
   stessa cosa aggiornati in momenti diversi sono un modo lento di sbagliare.

USO
    python3 scripts/build_comuni_cap.py
    python3 scripts/build_comuni_cap.py --dry-run

Serve rete verso raw.githubusercontent.com. Solo libreria standard.
"""
import argparse
import json
import os
import urllib.request

COMUNI_URL = "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json"
GEO_URL = (
    "https://raw.githubusercontent.com/MatteoHenryChinaski/"
    "Comuni-Italiani-2018-Sql-Json-excel/master/italy_geo.json"
)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "lib", "data", "comuni-italia.json")
OUT_SQL = os.path.join(HERE, "..", "supabase", "migrations", "086_comuni_italia.sql")

# Quante righe per ogni INSERT del seed. Una sola istruzione da 7.904 righe
# passa in psql ma non passa ovunque: l'API che applica le migrazioni ha un
# tetto sulla dimensione del corpo, e un file che si applica solo da un posto
# non e' una migrazione, e' una speranza.
RIGHE_PER_INSERT = 500

FONTE = (
    "Comuni e codici ISTAT: archivio ISTAT via matteocontrini/comuni-json "
    "(CC BY 3.0 IT). CAP: stessa raccolta, licenza non dichiarata dalla fonte "
    "— suggerimento, non verità. Coordinate: MatteoHenryChinaski/"
    "Comuni-Italiani-2018, appaiate sul codice ISTAT."
)


def scarica(url: str):
    with urllib.request.urlopen(url, timeout=120) as risposta:
        return json.loads(risposta.read().decode("utf-8"))


def costruisci() -> dict:
    comuni = scarica(COMUNI_URL)
    geo = scarica(GEO_URL)

    # Il file delle coordinate scrive il codice ISTAT senza gli zeri davanti.
    per_istat = {}
    for riga in geo:
        try:
            per_istat[int(riga["istat"])] = (float(riga["lat"]), float(riga["lng"]))
        except (KeyError, TypeError, ValueError):
            continue

    fuori = 0
    elenco = []
    for c in comuni:
        codice = c["codice"]
        punto = per_istat.get(int(codice))
        if punto is None:
            fuori += 1
        cap = sorted({x for x in c.get("cap", []) if x and len(x) == 5})
        elenco.append(
            {
                "i": codice,
                "n": c["nome"],
                "s": c["sigla"],
                "p": c["provincia"]["nome"],
                "r": c["regione"]["nome"],
                "c": cap,
                **({"lat": round(punto[0], 5), "lng": round(punto[1], 5)} if punto else {}),
            }
        )

    elenco.sort(key=lambda x: x["n"])
    regioni = sorted({c["r"] for c in elenco})
    print(f"{len(elenco)} comuni, {len(regioni)} regioni, {fuori} senza coordinate")
    print(f"CAP distinti: {len({x for c in elenco for x in c['c']})}")
    return {"fonte": FONTE, "regioni": regioni, "comuni": elenco}


def sql_literal(valore) -> str:
    if valore is None:
        return "null"
    return "'" + str(valore).replace("'", "''") + "'"


def riga_sql(c: dict) -> str:
    cap = "{" + ",".join(c["c"]) + "}"
    return "    ({}, {}, {}, {}, {}, {}, {}, {})".format(
        sql_literal(c["i"]),
        sql_literal(c["n"]),
        sql_literal(c["s"]),
        sql_literal(c["p"]),
        sql_literal(c["r"]),
        c.get("lat", "null") if c.get("lat") is not None else "null",
        c.get("lng", "null") if c.get("lng") is not None else "null",
        sql_literal(cap),
    )


def scrivi_sql(dati: dict) -> str:
    comuni = dati["comuni"]
    blocchi = []
    for inizio in range(0, len(comuni), RIGHE_PER_INSERT):
        pezzo = comuni[inizio : inizio + RIGHE_PER_INSERT]
        righe = ",\n".join(riga_sql(c) for c in pezzo)
        blocchi.append(SEED.format(righe=righe))
    return TESTA.format(
        n_comuni=len(comuni),
        n_regioni=len(dati["regioni"]),
        n_blocchi=len(blocchi),
        righe_per_blocco=RIGHE_PER_INSERT,
    ) + "\n".join(blocchi) + CODA


TESTA = """-- 086: i comuni italiani, tutti e {n_comuni}.
--
-- PERCHÉ
-- Fuori da Milano non esiste niente su cui disegnare un'area di lavoro. Le
-- zone (city_zones) sono i quartieri delle città che li pubblicano in dati
-- aperti — oggi solo Milano, con gli 88 NIL della 084 — e sotto non c'è nessun
-- livello intermedio: un professionista di Sesto San Giovanni, o di Bergamo,
-- non ha modo di dire dove lavora se non «tutta la provincia».
-- Il comune è l'unità che esiste ovunque in Italia, e questa tabella la mette
-- dove serve che stia: in database, perché «quali comuni cadono nel mio
-- raggio» è una domanda che deve rispondere il server — come già fa
-- private.zones_in_circle per i quartieri — e non un giro di JavaScript che
-- si porta dietro un megabyte di elenco.
--
-- LE DUE GRIGLIE, E COME CONVIVONO
-- Dentro una città che ha i suoi quartieri si continua a coprire a quartieri;
-- fuori si copre a comuni. Sono due livelli della stessa cosa, non due sistemi:
-- cities.comune_istat, aggiunta qui, dice quale comune È una città di Bob, così
-- il confine fra i due livelli è un dato e non una regola scritta nel codice.
--
-- LA FONTE
-- Comuni e codici ISTAT dall'archivio ISTAT (CC BY 3.0 IT, attribuzione nella
-- colonna source di ogni riga); coordinate appaiate sul codice ISTAT; CAP da
-- una raccolta che non dichiara licenza — vale come suggerimento, non come
-- verità, ed è il motivo per cui nessun vincolo qui dentro li usa per
-- rifiutare qualcosa (decisione del 17/09/2026, docs/NOTE_E_DECISIONI.md).
-- Il file e questo seed escono dalla stessa passata di
-- scripts/build_comuni_cap.py: due elenchi della stessa cosa aggiornati in
-- momenti diversi sono un modo lento di sbagliare.
--
-- CONFORMITÀ
-- Nessun dato personale: è geografia pubblica, come city_zones. Lettura per
-- tutti, scrittura solo staff. Nessun fornitore nuovo: il dato è nel repo e
-- lo serve il nostro database. Nessun trigger DPIA.
--
-- Idempotente: create table if not exists, upsert sulla chiave primaria,
-- funzione in create or replace. Il seed è spezzato in {n_blocchi} istruzioni da
-- {righe_per_blocco} righe: una sola da {n_comuni} non passa da tutte le strade
-- con cui questo file può essere applicato.

-- ---------------------------------------------------------------------------
-- 1. La tabella
-- ---------------------------------------------------------------------------

create table if not exists public.comuni (
  istat text primary key,
  nome text not null,
  sigla text not null,
  provincia text not null,
  regione text not null,
  lat double precision,
  lng double precision,
  cap text[] not null default '{{}}',
  source text,
  updated_at timestamptz not null default now()
);

alter table public.comuni enable row level security;

-- Geografia pubblica: nessun dato personale, lettura per tutti.
drop policy if exists "Anyone reads comuni" on public.comuni;
create policy "Anyone reads comuni" on public.comuni
  for select using (true);

drop policy if exists "Staff manages comuni" on public.comuni;
create policy "Staff manages comuni" on public.comuni
  for all using (private.is_admin_or_cs()) with check (private.is_admin_or_cs());

create index if not exists comuni_provincia_idx on public.comuni (provincia);
create index if not exists comuni_regione_idx on public.comuni (regione);
create index if not exists comuni_cap_idx on public.comuni using gin (cap);

comment on table public.comuni is
  'I comuni italiani: l''unità di copertura fuori dalle città che hanno i propri quartieri in city_zones. Geografia pubblica (ISTAT, CC BY 3.0 IT). La genera scripts/build_comuni_cap.py insieme a src/lib/data/comuni-italia.json.';
comment on column public.comuni.istat is
  'Codice ISTAT a sei cifre, zeri davanti compresi. È la chiave: il nome cambia con le fusioni, il codice no.';
comment on column public.comuni.cap is
  'I CAP del comune. Da fonte non ufficiale (l''elenco completo è di Poste Italiane): serve a suggerire e a cercare, mai a rifiutare un CAP che una persona dichiara.';
comment on column public.comuni.lat is
  'Centro del comune. Null su una manciata di comuni nati da fusioni recenti: chi legge deve reggere il vuoto, non dare per scontato il punto.';

-- ---------------------------------------------------------------------------
-- 2. I {n_comuni} comuni
-- ---------------------------------------------------------------------------

"""

SEED = """insert into public.comuni (istat, nome, sigla, provincia, regione, lat, lng, cap, source, updated_at)
select v.istat, v.nome, v.sigla, v.provincia, v.regione, v.lat, v.lng, v.cap::text[],
       'ISTAT (CC BY 3.0 IT) — coordinate e CAP da raccolte di terzi, vedi NOTE_E_DECISIONI 17/09/2026', now()
  from (values
{righe}
  ) as v (istat, nome, sigla, provincia, regione, lat, lng, cap)
on conflict (istat) do update
   set nome = excluded.nome,
       sigla = excluded.sigla,
       provincia = excluded.provincia,
       regione = excluded.regione,
       lat = excluded.lat,
       lng = excluded.lng,
       cap = excluded.cap,
       source = excluded.source,
       updated_at = now();

"""

CODA = """
-- ---------------------------------------------------------------------------
-- 3. Quale comune è una città di Bob
-- ---------------------------------------------------------------------------
--
-- Serve a sapere dove finisce un livello e comincia l'altro: a Milano il
-- professionista copre quartieri, a Sesto copre comuni. Senza questa colonna
-- il confine sarebbe una lista di nomi scritta nel codice, e i nomi cambiano.

alter table public.cities
  add column if not exists comune_istat text references public.comuni (istat);

comment on column public.cities.comune_istat is
  'Il comune corrispondente a questa città di Bob. Dove c''è, la copertura dentro quella città si disegna a quartieri (city_zones); fuori si disegna a comuni.';

update public.cities c
   set comune_istat = m.istat
  from public.comuni m
 where m.nome = c.name
   and m.provincia = c.province
   and c.comune_istat is distinct from m.istat;

-- ---------------------------------------------------------------------------
-- 4. Quali comuni cadono nel cerchio
-- ---------------------------------------------------------------------------
--
-- La gemella di private.zones_in_circle, stessa formula dell'emisenoverso e
-- stesso motivo per cui non serve PostGIS: sono ottomila righe con un punto,
-- non geometrie. Il centro del cerchio resta dove sta — nella riga privata
-- della copertura — e da qui esce solo l'elenco dei comuni.

create or replace function private.comuni_nel_cerchio(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $BODY$
  select coalesce(array_agg(m.istat order by m.istat), '{}')
  from public.comuni m
  where m.lat is not null
    and m.lng is not null
    and 6371000 * 2 * asin(sqrt(
          power(sin(radians(m.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(m.lat))
            * power(sin(radians(m.lng - p_lng) / 2), 2)
        )) <= p_radius_m;
$BODY$;
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    argomenti = parser.parse_args()

    dati = costruisci()
    milano = next(c for c in dati["comuni"] if c["i"] == "015146")
    print(f"controllo — Milano: {len(milano['c'])} CAP, {milano.get('lat')},{milano.get('lng')}")

    citta_bob = [c for c in dati["comuni"] if c["n"] in ("Milano", "Roma", "Torino")]
    for c in citta_bob:
        print(f"controllo — citta di Bob: {c['n']} ({c['p']}) istat {c['i']}")

    if argomenti.dry_run:
        return
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"scritto {os.path.relpath(OUT)} ({os.path.getsize(OUT) // 1024} KB)")

    with open(OUT_SQL, "w", encoding="utf-8") as f:
        f.write(scrivi_sql(dati))
    print(f"scritto {os.path.relpath(OUT_SQL)} ({os.path.getsize(OUT_SQL) // 1024} KB)")


if __name__ == "__main__":
    main()
