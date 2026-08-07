#!/usr/bin/env python3
"""Riempie le coordinate dei quartieri in src/lib/zones.ts.

PERCHÉ ESISTE
Le coordinate dei quartieri non sono scritte a mano: un nome sbagliato si nota
subito, una coordinata sbagliata manda un professionista dall'altra parte della
città senza che nessuno se ne accorga. Questo script le prende dal dataset
ufficiale NIL (Nuclei di Identità Locale) del Comune di Milano, che pubblica il
centroide di ogni nucleo già in EPSG:4326 (licenza CC-BY, attribuzione dovuta).

COSA FA
Scarica il CSV dei NIL, accosta ogni zona del nostro elenco corto a uno o più
NIL ufficiali, calcola il centro medio e riscrive il blocco MILANO_ZONES in
src/lib/zones.ts. I nomi restano quelli colloquiali: "Navigli" è più chiaro di
"NIL 34 — Giardini Guastalla" per chi deve scegliere in chat.

USO
    python3 scripts/build_milano_zones.py
    python3 scripts/build_milano_zones.py --dry-run     # stampa e basta

Serve rete verso dati.comune.milano.it. Solo libreria standard.
"""
import argparse, csv, io, json, os, re, sys, unicodedata
import urllib.request

CSV_URL = (
    "https://dati.comune.milano.it/dataset/e8e765fc-d882-40b8-95d8-16ff3d39eb7c/"
    "resource/3fce7202-0076-4a7b-ac2c-d2ab9b5dc658/download/ds964_nil_wm_4326.csv"
)
HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "..", "src", "lib", "zones.ts")

# Elenco corto -> NIL ufficiali che lo compongono. I nomi a destra vengono
# confrontati in modo tollerante (minuscole, senza accenti, sottostringa), così
# una revisione del PGT che ritocca la punteggiatura non rompe lo script.
ZONES = [
    ("centro",         "Centro / Duomo",              ["DUOMO"]),
    ("brera",          "Brera",                       ["BRERA"]),
    ("isola",          "Isola",                       ["ISOLA"]),
    ("porta-nuova",    "Porta Nuova / Garibaldi",     ["PORTA GARIBALDI", "PORTA NUOVA"]),
    ("porta-venezia",  "Porta Venezia",               ["BUENOS AIRES", "PORTA VENEZIA"]),
    ("porta-romana",   "Porta Romana",                ["PORTA ROMANA", "GUASTALLA"]),
    ("navigli",        "Navigli",                     ["NAVIGLI"]),
    ("ticinese",       "Ticinese",                    ["TICINESE"]),
    ("sempione",       "Sempione / Arco della Pace",  ["SEMPIONE"]),
    ("citta-studi",    "Città Studi",                 ["CITTA STUDI", "CITTÀ STUDI"]),
    ("lambrate",       "Lambrate",                    ["LAMBRATE"]),
    ("bicocca",        "Bicocca",                     ["BICOCCA"]),
    ("bovisa",         "Bovisa",                      ["BOVISA"]),
    ("affori",         "Affori",                      ["AFFORI"]),
    ("niguarda",       "Niguarda",                    ["NIGUARDA"]),
    ("greco",          "Greco",                       ["GRECO"]),
    ("loreto",         "Loreto",                      ["LORETO"]),
    ("corvetto",       "Corvetto",                    ["CORVETTO"]),
    ("rogoredo",       "Rogoredo / Santa Giulia",     ["ROGOREDO"]),
    ("barona",         "Barona",                      ["BARONA"]),
    ("famagosta",      "Famagosta",                   ["STADERA", "FAMAGOSTA"]),
    ("san-siro",       "San Siro",                    ["SAN SIRO"]),
    ("baggio",         "Baggio",                      ["BAGGIO"]),
    ("quarto-oggiaro", "Quarto Oggiaro",              ["QUARTO OGGIARO"]),
    ("washington",     "Washington / De Angeli",      ["WASHINGTON", "DE ANGELI"]),
    ("bande-nere",     "Bande Nere / Lorenteggio",    ["BANDE NERE", "LORENTEGGIO"]),
    ("forlanini",      "Forlanini",                   ["FORLANINI"]),
    ("gratosoglio",    "Gratosoglio",                 ["GRATOSOGLIO"]),
]


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    # spazi ripetuti collassati: "CITTA' STUDI" diventa "citta studi" e non
    # "citta  studi", altrimenti il confronto per sottostringa fallisce proprio
    # sui nomi con apostrofo, che a Milano sono parecchi.
    return re.sub(r"\s+", " ", s).strip()


def fetch_rows():
    print(f"scarico {CSV_URL} …")
    with urllib.request.urlopen(CSV_URL, timeout=90) as r:
        raw = r.read().decode("utf-8-sig", errors="replace")
    rows = list(csv.DictReader(io.StringIO(raw), delimiter=";"))
    if len(rows) < 2 or len(rows[0]) < 2:
        rows = list(csv.DictReader(io.StringIO(raw), delimiter=","))
    print(f"  {len(rows)} righe, colonne: {', '.join(list(rows[0]))}")
    return rows


def pick(row, *candidates):
    """Prima l'uguaglianza esatta, poi la sottostringa.

    Serve perche' il CSV del Comune non chiama le colonne "LAT"/"LONG" ma
    LAT_Y_4326_CENTROID e LONG_X_4326_CENTROID. Cercando solo l'uguaglianza
    esatta le coordinate non si trovavano mai, e ogni zona finiva nell'elenco
    dei "nomi non corrispondenti" — un messaggio che indicava il posto
    sbagliato in cui cercare il problema.
    """
    cands = [norm(c).strip() for c in candidates]
    for k in row:
        if norm(k).strip() in cands:
            return row[k]
    for k in row:
        nk = norm(k).strip()
        if any(re.search(r"(^| )" + re.escape(c) + r"($| |_)", nk) or
               nk.startswith(c + " ") or c in nk.split() for c in cands):
            return row[k]
    return None


def centroid_of(rows, needles):
    pts = []
    for row in rows:
        name = pick(row, "NIL", "nil", "Nome NIL", "nome_nil", "NILDESCR") or ""
        n = norm(name)
        if any(norm(x) in n for x in needles):
            lat = pick(row, "LAT_Y_4326_CENTROID", "LAT", "lat", "Y", "latitude", "coord_y")
            lng = pick(row, "LONG_X_4326_CENTROID", "LONG", "LON", "lng", "X", "longitude", "coord_x")
            try:
                pts.append((float(str(lat).replace(",", ".")),
                            float(str(lng).replace(",", "."))))
            except (TypeError, ValueError):
                continue
    if not pts:
        return None
    return (round(sum(p[0] for p in pts) / len(pts), 5),
            round(sum(p[1] for p in pts) / len(pts), 5))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows = fetch_rows()
    out, missing = [], []
    for slug, label, needles in ZONES:
        c = centroid_of(rows, needles)
        if c is None:
            missing.append(f"{slug} (cercavo: {', '.join(needles)})")
            out.append(f'  {{ slug: "{slug}", label: "{label}", lat: null, lng: null }},')
        else:
            out.append(f'  {{ slug: "{slug}", label: "{label}", lat: {c[0]}, lng: {c[1]} }},')

    block = "export const MILANO_ZONES: Zone[] = [\n" + "\n".join(out) + "\n];"

    if missing:
        print("\n[!] Zone senza corrispondenza nei NIL ufficiali "
              "(restano senza coordinate, l'etichetta funziona lo stesso):")
        for m in missing:
            print("    " + m)
        print("    -> controlla i nomi in ZONES contro il CSV scaricato.")

    if args.dry_run:
        print("\n" + block)
        return 0

    src = open(TARGET, encoding="utf-8").read()
    new = re.sub(r"export const MILANO_ZONES: Zone\[\] = \[.*?\n\];",
                 block.replace("\\", "\\\\"), src, flags=re.S)
    if not re.search(r"export const MILANO_ZONES: Zone\[\] = \[.*?\n\];", src, flags=re.S):
        sys.exit("non ho trovato il blocco MILANO_ZONES in src/lib/zones.ts")
    if new == src:
        print("\nsrc/lib/zones.ts era gia' identico: nessuna coordinata nuova da scrivere.")
        return 0
    open(TARGET, "w", encoding="utf-8").write(new)
    done = len(ZONES) - len(missing)
    print(f"\nsrc/lib/zones.ts aggiornato — {done}/{len(ZONES)} zone con coordinate.")
    print("Attribuzione dovuta (CC-BY): Comune di Milano, dataset NIL ds964.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
