#!/usr/bin/env python3
"""Le 88 zone di Milano: dai NIL ufficiali alla tabella city_zones.

PERCHÉ ESISTE
Fino a oggi Milano aveva 28 zone: un elenco corto, scritto a mano, comodo per
il cliente in chat («Isola», «Navigli») e insufficiente per il professionista,
che con quelle 28 caselle non può dire dove lavora davvero — 55 nuclei su 88
non avevano nessuna casella, e la mappa li disegnava senza poterli scegliere.
Questo script prende gli 88 NIL (Nuclei di Identità Locale) del Comune di
Milano e li trasforma nella griglia vera della copertura.

DA DOVE VENGONO I DATI
Da public/geo/milano-nil.geojson, che è già nel repo: i perimetri dei NIL
pubblicati dal Comune in licenza CC-BY (dataset ds964), scaricati una volta da
scripts/build_milano_nil_geojson.py. Nessuna rete, quindi: il file c'è già e
questo script non esce da Bob.

IL CENTRO DI UNA ZONA, QUI, NON È COPIATO: È CALCOLATO
Il centroide viene dal poligono, pesato sull'area di ogni anello e al netto dei
buchi. È il punto che sta dentro la forma che si vede sulla mappa — mentre il
centroide del CSV è un altro numero, calcolato altrove, che a volte cade fuori
dal disegno. Un centro sbagliato non si vede: manda un professionista in una
zona che non ha scelto.

I GRUPPI: I 28 NOMI DI PRIMA NON SI BUTTANO
`src/lib/zones.ts` continua a servire il percorso del cliente con i 28 nomi
colloquiali (ed è area di André: questo script non lo tocca). Ogni NIL porta
con sé `group_slug`, il nome corto di prima a cui appartiene, e la migrazione
usa quel campo per emettere anche il gettone del gruppo: una richiesta che dice
«Navigli» continua a incontrare il professionista che copre Ronchetto sul
Naviglio. Nessuna riga esistente resta orfana.

USO
    python3 scripts/build_milano_nil_zones.py            # scrive i due file
    python3 scripts/build_milano_nil_zones.py --dry-run  # stampa e basta

Solo libreria standard.
"""
import argparse
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
GEOJSON = os.path.join(HERE, "..", "public", "geo", "milano-nil.geojson")
OUT_SQL = os.path.join(HERE, "..", "supabase", "migrations", "084_zone_nil_milano.sql")
OUT_JSON = os.path.join(HERE, "..", "src", "lib", "milano-nil.generated.json")

# Le abbreviazioni del catasto comunale non sono nomi che una persona legge.
SOSTITUZIONI = [
    (r"\bPTA\b", "PORTA"),
    (r"\bP\.TA\b", "PORTA"),
    (r"\bQ\.RE\b", "QUARTIERE"),
    (r"\bS\.\b", "SAN"),
    (r"\bQT 8\b", "QT8"),
]

# Parole che restano minuscole in mezzo a un nome.
MINUSCOLE = {
    "di", "del", "dello", "della", "dei", "degli", "delle",
    "il", "lo", "la", "i", "gli", "le",
    "in", "e", "ed", "al", "alla", "a", "da", "con", "per", "su", "sul", "sui", "sulla",
}

# I nomi con l'accento finale scritto con l'apostrofo, e le eccezioni vere.
ACCENTI = {"CITTA'": "Città", "MONLUE'": "Monluè", "CITTA' ": "Città"}
APOSTROFO_VERO = {"CA'", "P.ZA", "L'"}


def pulisci(nome: str) -> str:
    """Il nome ufficiale, scritto come lo leggerebbe una persona."""
    testo = nome.strip()
    for pattern, sostituto in SOSTITUZIONI:
        testo = re.sub(pattern, sostituto, testo)
    pezzi = []
    for parola in testo.split():
        if parola in ACCENTI:
            pezzi.append(ACCENTI[parola])
            continue
        if parola in APOSTROFO_VERO:
            pezzi.append(parola.capitalize() if parola != "CA'" else "Ca'")
            continue
        if parola.endswith("'") and len(parola) > 2:
            # CITTA' -> Città: l'apostrofo finale è un accento scritto male.
            vocali = {"A": "à", "E": "è", "I": "ì", "O": "ò", "U": "ù"}
            base, ultima = parola[:-2], parola[-2]
            if ultima in vocali:
                pezzi.append(base.capitalize() + vocali[ultima])
                continue
        # I numeri romani restano maiuscoli (XXII MARZO) — ma «IL» è fatto di
        # lettere romane e non è un numero: le parole piccole vengono prima.
        if parola.lower() not in MINUSCOLE and re.fullmatch(r"[IVXLC]{2,}", parola):
            pezzi.append(parola)
            continue
        if re.fullmatch(r"QT\d+", parola):
            pezzi.append(parola)
            continue
        if parola == "-":
            pezzi.append("-")
            continue
        minuscola = parola.lower()
        pezzi.append(minuscola if minuscola in MINUSCOLE and pezzi else minuscola.capitalize())
    return " ".join(pezzi)


def slugifica(testo: str) -> str:
    piatto = unicodedata.normalize("NFKD", testo).encode("ascii", "ignore").decode()
    piatto = re.sub(r"[^a-zA-Z0-9]+", "-", piatto).strip("-").lower()
    return re.sub(r"-{2,}", "-", piatto)


def segmenti(nome: str) -> list[str]:
    """Il nome ufficiale spezzato sui trattini che separano le frazioni."""
    return [p.strip() for p in re.split(r"\s+-\s+", nome) if p.strip()]


def pezzi_utili(nome: str) -> list[str]:
    """I pezzi del nome che valgono come etichetta.

    «Baggio - Q.re degli Olmi - Q.re Valsesia» per chi sceglie una zona è
    «Baggio»: i quartieri di edilizia popolare citati dopo sono frazioni del
    nucleo, non il suo nome. Ma dove il nome INIZIA con un quartiere — «Q.re
    Gallaratese» — toglierli lascerebbe «Lampugnano», che non è come lo chiama
    nessuno. Quindi: se c'è almeno un pezzo che non è un quartiere in testa,
    i quartieri si lasciano cadere; altrimenti si tengono, senza la sigla.
    """
    parti = segmenti(nome)
    quartiere = lambda p: p.upper().startswith(("Q.RE", "QUARTIERE"))
    if parti and not quartiere(parti[0]):
        tenuti = [p for p in parti if not quartiere(p)]
    else:
        tenuti = [re.sub(r"^(Q\.RE|QUARTIERE)\s+", "", p, flags=re.I) for p in parti]
    return tenuti or parti


# Due nuclei che il generatore del 30 agosto non aveva accostato al nome corto
# perché il confronto era sulla stringa: «PTA ROMANA» non contiene «PORTA
# ROMANA», e i Giardini di Porta Venezia stanno scritti «GIARDINI P.TA
# VENEZIA». Sono Porta Romana e Porta Venezia per chiunque ci abiti.
CORREZIONI_GRUPPO = {
    "PTA ROMANA": "porta-romana",
    "GIARDINI P.TA VENEZIA": "porta-venezia",
}


def centroide(geometria: dict) -> tuple[float, float]:
    """Centro dell'area, pesato sugli anelli: esterni positivi, buchi negativi."""
    aree, cx, cy = 0.0, 0.0, 0.0
    poligoni = geometria["coordinates"]
    if geometria["type"] == "Polygon":
        poligoni = [poligoni]
    for poligono in poligoni:
        for indice, anello in enumerate(poligono):
            area, ax, ay = area_centro(anello)
            segno = 1.0 if indice == 0 else -1.0
            aree += segno * area
            cx += segno * ax * area
            cy += segno * ay * area
    if aree == 0:
        punti = [p for poligono in poligoni for anello in poligono for p in anello]
        return (
            round(sum(p[1] for p in punti) / len(punti), 5),
            round(sum(p[0] for p in punti) / len(punti), 5),
        )
    return (round(cy / aree, 5), round(cx / aree, 5))


def area_centro(anello: list) -> tuple[float, float, float]:
    """Area con segno e centro di un anello chiuso (formula del poligono)."""
    doppia_area = 0.0
    cx = cy = 0.0
    for i in range(len(anello) - 1):
        x1, y1 = anello[i][0], anello[i][1]
        x2, y2 = anello[i + 1][0], anello[i + 1][1]
        incrocio = x1 * y2 - x2 * y1
        doppia_area += incrocio
        cx += (x1 + x2) * incrocio
        cy += (y1 + y2) * incrocio
    if doppia_area == 0:
        return 0.0, 0.0, 0.0
    area = doppia_area / 2.0
    return abs(area), cx / (3.0 * doppia_area), cy / (3.0 * doppia_area)


def costruisci() -> list[dict]:
    with open(GEOJSON, encoding="utf-8") as f:
        collezione = json.load(f)

    grezze = []
    for feature in collezione["features"]:
        nome = feature["properties"]["nil"]
        gruppo = feature["properties"].get("zona") or CORREZIONI_GRUPPO.get(nome.strip())
        lat, lng = centroide(feature["geometry"])
        parti = pezzi_utili(nome)
        grezze.append(
            {
                "nome_ufficiale": pulisci(nome),
                # Due pezzi: «Lodi» da solo non si riconosce, «Lodi - Corvetto»
                # sì, e il nome intero non sta in una pastiglia.
                "etichetta": pulisci(" - ".join(parti[:2])),
                "gruppo": gruppo,
                "lat": lat,
                "lng": lng,
                "_parti": parti,
            }
        )

    # Lo slug nasce dal primo pezzo del nome. Dove due nuclei condividono il
    # primo pezzo — «Porta Ticinese - Conchetta» e «Porta Ticinese - Conca del
    # Naviglio» — si allunga fino a distinguerli, per tutti quelli in conflitto.
    conteggio: dict[str, int] = {}
    for z in grezze:
        primo = slugifica(pulisci(z["_parti"][0]))
        conteggio[primo] = conteggio.get(primo, 0) + 1
    for z in grezze:
        base = slugifica(pulisci(z["_parti"][0]))
        if conteggio[base] > 1 and len(z["_parti"]) > 1:
            z["slug"] = slugifica(pulisci(" ".join(z["_parti"][:2])))
        else:
            z["slug"] = base
        del z["_parti"]

    doppi = [s for s, n in {z["slug"]: sum(1 for y in grezze if y["slug"] == z["slug"]) for z in grezze}.items() if n > 1]
    if doppi:
        sys.exit(f"Slug ripetuti, il seed non sarebbe valido: {doppi}")
    return sorted(grezze, key=lambda z: z["slug"])


def sql_literal(valore) -> str:
    if valore is None:
        return "null"
    return "'" + str(valore).replace("'", "''") + "'"


def scrivi_sql(zone: list[dict]) -> str:
    gruppi: dict[str, list[str]] = {}
    for z in zone:
        if z["gruppo"]:
            gruppi.setdefault(z["gruppo"], []).append(z["slug"])

    righe = ",\n".join(
        "    ({}, {}, {}, {}, {}, {})".format(
            sql_literal(z["slug"]),
            sql_literal(z["etichetta"]),
            z["lat"],
            z["lng"],
            sql_literal(z["gruppo"]),
            sql_literal(z["nome_ufficiale"]),
        )
        for z in zone
    )
    coppie = ",\n".join(
        "    ({}, {})".format(sql_literal(vecchio), sql_literal(nuovo))
        for vecchio, nuovi in sorted(gruppi.items())
        for nuovo in nuovi
    )
    return TEMPLATE.format(
        n_zone=len(zone),
        n_gruppi=len(gruppi),
        righe=righe,
        coppie=coppie,
    )


TEMPLATE = """-- 084: Milano passa da 28 nomi corti a {n_zone} nuclei ufficiali.
--
-- PERCHÉ
-- Le 28 zone erano un elenco scritto a mano per il cliente in chat: nomi che
-- una persona riconosce («Isola», «Navigli»). Al professionista servono per
-- dire dove lavora, e lì non bastano: 55 nuclei su {n_zone} non avevano nessuna
-- casella. La mappa li disegnava — il perimetro c'è, è nel geojson dei NIL — e
-- non si potevano scegliere. Chi lavora a Trenno, a Dergano, a Comasina non
-- aveva modo di dirlo.
--
-- COSA CAMBIA
-- city_zones per Milano diventa la griglia dei NIL (Nuclei di Identità Locale,
-- dataset ds964 del Comune di Milano, CC-BY). Il centro di ogni zona è il
-- centroide del suo poligono, calcolato dall'area: sta dentro la forma che si
-- vede sulla mappa. Lo genera scripts/build_milano_nil_zones.py dal file che è
-- già nel repo, senza rete.
--
-- I 28 NOMI DI PRIMA NON SPARISCONO
-- Restano in src/lib/zones.ts — il percorso del cliente, area di André, non
-- toccato da qui — e ogni nucleo porta `group_slug`, il nome corto a cui
-- appartiene. `private.coverage_keys_for` emette anche il gettone del gruppo,
-- quindi una richiesta che dice «Navigli» continua a incontrare il
-- professionista che copre Ronchetto sul Naviglio. Le zone scelte a mano con i
-- vecchi nomi vengono spostate sui nuclei corrispondenti, non azzerate.
--
-- LA SCELTA DA RIVEDERE, SCRITTA QUI PERCHÉ NON SI PERDA
-- Il gettone del gruppo si emette se il professionista copre ALMENO UNO dei
-- nuclei del gruppo, non tutti. Con quattro gruppi su 28 composti da più
-- nuclei, pretendere l'insieme completo farebbe perdere incontri veri; così
-- invece un professionista che copre un pezzo di «Navigli» risulta su
-- «Navigli». Per stringere basta cambiare il ciclo dei gruppi in questa
-- funzione: `having count(*) = (numero dei nuclei del gruppo)`.
--
-- CONFORMITÀ
-- Base giuridica: art. 6(1)(b) — la zona di lavoro è ciò che il professionista
--   pubblica per essere raggiunto. Nessuna finalità nuova rispetto alla 057.
-- Dati personali: nessuno qui dentro. city_zones è geografia pubblica del
--   Comune; la geometria del professionista resta in professional_coverage,
--   privata, e continua a non uscire (pubblici solo i gettoni).
-- Nuovo fornitore: nessuno. Il file è nostro, servito dal nostro dominio.
-- Conservazione: invariata. DPIA: nessun trigger di §7.3.
-- Attribuzione CC-BY: «Comune di Milano — dataset NIL ds964», già nella
--   colonna `source` di ogni riga.
--
-- Idempotente: colonne con if not exists, upsert sulla chiave (city_id, slug),
-- funzione in create or replace, pulizia legata alla colonna source.

-- ---------------------------------------------------------------------------
-- 1. Due colonne: il gruppo di prima, e il nome ufficiale per intero
-- ---------------------------------------------------------------------------

alter table public.city_zones
  add column if not exists group_slug text,
  add column if not exists nome_ufficiale text;

comment on column public.city_zones.group_slug is
  'Il nome corto di src/lib/zones.ts a cui questo nucleo appartiene (Milano: 28 gruppi su {n_zone} nuclei). Serve a far incontrare una richiesta scritta col nome colloquiale e una copertura disegnata sui nuclei. Null dove il nucleo non sta in nessun gruppo.';

comment on column public.city_zones.nome_ufficiale is
  'Il nome del nucleo come lo pubblica il Comune, per esteso. L''etichetta breve sta in label.';

create index if not exists city_zones_group_idx
  on public.city_zones (city_id, group_slug);

-- ---------------------------------------------------------------------------
-- 2. I {n_zone} nuclei
-- ---------------------------------------------------------------------------

insert into public.city_zones (city_id, slug, label, lat, lng, group_slug, nome_ufficiale, source, updated_at)
select c.id, v.slug, v.label, v.lat, v.lng, v.group_slug, v.nome_ufficiale,
       'Comune di Milano — NIL ds964 (CC-BY)', now()
  from public.cities c
  cross join (values
{righe}
  ) as v (slug, label, lat, lng, group_slug, nome_ufficiale)
 where c.slug = 'milano'
on conflict (city_id, slug) do update
   set label = excluded.label,
       lat = excluded.lat,
       lng = excluded.lng,
       group_slug = excluded.group_slug,
       nome_ufficiale = excluded.nome_ufficiale,
       source = excluded.source,
       updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Le zone scelte a mano si spostano sui nuclei, prima che i nomi vecchi
--    spariscano dalla tabella
-- ---------------------------------------------------------------------------

with mappa (vecchio, nuovo) as (values
{coppie}
),
spostate as (
  select c.id,
         array_agg(distinct coalesce(m.nuovo, s) order by coalesce(m.nuovo, s)) as nuovi
    from public.professional_coverage c
    join public.cities ci on ci.id = c.city_id and ci.slug = 'milano'
    cross join lateral unnest(coalesce(c.zone_slugs, '{{}}'::text[])) as s
    left join mappa m on m.vecchio = s
   where c.mode <> 'circle'
   group by c.id
)
update public.professional_coverage c
   set zone_slugs = s.nuovi
  from spostate s
 where s.id = c.id
   and c.zone_slugs is distinct from s.nuovi;

-- ---------------------------------------------------------------------------
-- 4. Via i 28 nomi corti dalla griglia: da qui in poi vivono come gruppo
-- ---------------------------------------------------------------------------

delete from public.city_zones z
 using public.cities c
 where c.id = z.city_id
   and c.slug = 'milano'
   and z.source is distinct from 'Comune di Milano — NIL ds964 (CC-BY)';

-- ---------------------------------------------------------------------------
-- 5. I gettoni: nucleo e, insieme, il gruppo a cui appartiene
-- ---------------------------------------------------------------------------

create or replace function private.coverage_keys_for(p_coverage_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $BODY$
declare
  r record;
  keys text[] := '{{}}';
  z text;
  g text;
begin
  select c.scope, c.zone_slugs, c.works_remote, c.city_id,
         ci.slug as city_slug, ci.province, ci.region, ci.macro_region
    into r
    from public.professional_coverage c
    left join public.cities ci on ci.id = c.city_id
   where c.id = p_coverage_id;

  if not found then
    return '{{}}';
  end if;

  if r.works_remote then
    keys := keys || 'remote:*'::text;
  end if;

  if r.scope = 'national' then
    return keys || 'it:*'::text;
  elsif r.scope = 'macro_region' then
    return keys || ('macro:' || private.slugify(r.macro_region));
  elsif r.scope = 'region' then
    return keys || ('reg:' || private.slugify(r.region));
  elsif r.scope = 'province' then
    return keys || ('prov:' || private.slugify(r.province));
  elsif r.scope = 'city' then
    return keys || ('city:' || r.city_slug);
  end if;

  -- scope = 'zones': un gettone per nucleo, con la città nel nome perché
  -- "centro" esiste in ogni città d'Italia.
  foreach z in array coalesce(r.zone_slugs, '{{}}') loop
    keys := keys || ('zone:' || r.city_slug || '/' || z);
  end loop;

  -- E uno per ogni gruppo toccato: il cliente in chat sceglie ancora i nomi
  -- corti, e senza questo pezzo la sua richiesta non troverebbe nessuno.
  for g in
    select distinct zz.group_slug
      from public.city_zones zz
     where zz.city_id = r.city_id
       and zz.group_slug is not null
       and zz.slug = any(coalesce(r.zone_slugs, '{{}}'))
  loop
    keys := keys || ('zone:' || r.city_slug || '/' || g);
  end loop;

  return keys;
end;
$BODY$;

-- ---------------------------------------------------------------------------
-- 6. Ricalcolo: i cerchi si ridisegnano sulla griglia nuova, i gettoni
--    pubblici si riscrivono. Lo fanno i trigger della 057, basta toccare le
--    righe.
-- ---------------------------------------------------------------------------

update public.professional_coverage set updated_at = now();
"""


def scrivi_geojson(zone: list[dict]) -> int:
    """Aggiunge a ogni nucleo la sua slug, così la mappa può colorarlo."""
    with open(GEOJSON, encoding="utf-8") as f:
        collezione = json.load(f)
    per_nome = {z["nome_ufficiale"]: z for z in zone}
    toccati = 0
    for feature in collezione["features"]:
        chiave = pulisci(feature["properties"]["nil"])
        zona = per_nome.get(chiave)
        if not zona:
            continue
        feature["properties"]["slug"] = zona["slug"]
        feature["properties"]["gruppo"] = zona["gruppo"]
        feature["properties"]["nome"] = zona["nome_ufficiale"]
        toccati += 1
    with open(GEOJSON, "w", encoding="utf-8") as f:
        json.dump(collezione, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    return toccati


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    argomenti = parser.parse_args()

    zone = costruisci()
    gruppi = sorted({z["gruppo"] for z in zone if z["gruppo"]})
    senza_gruppo = [z for z in zone if not z["gruppo"]]

    print(f"{len(zone)} nuclei, {len(gruppi)} gruppi, {len(senza_gruppo)} senza gruppo")
    for z in zone:
        print(f"  {z['slug']:42s} {z['lat']:.5f},{z['lng']:.5f}  {z['gruppo'] or '—':16s} {z['etichetta']}")

    if argomenti.dry_run:
        return

    sql = scrivi_sql(zone)
    with open(OUT_SQL, "w", encoding="utf-8") as f:
        f.write(sql)
    toccati = scrivi_geojson(zone)
    print(f"\nscritto {os.path.relpath(OUT_SQL)} ({len(sql.splitlines())} righe)")
    print(f"aggiornato {os.path.relpath(GEOJSON)}: {toccati} forme con la slug")


if __name__ == "__main__":
    main()
