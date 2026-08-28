#!/usr/bin/env python3
"""Scrive public/geo/milano-nil.geojson: la forma dei quartieri di Milano.

PERCHÉ ESISTE
La mappa dell'area di lavoro mostrava solo i centri dei quartieri, cioè dei
pallini sospesi nel vuoto: «non si vede proprio Milano sotto» (28/08). Per
vedere la città serve la sua geometria. Non tile di un fornitore — quelle
farebbero uscire da Bob l'IP del professionista e la porzione di città che
guarda — ma il perimetro dei NIL (Nuclei di Identità Locale) pubblicato dal
Comune di Milano in licenza CC-BY: un file nostro, servito dal nostro dominio.

PERCHÉ NON LO SCARICA CLAUDE
La sessione Claude non ha accesso di rete a dati.comune.milano.it. Questo
script si lancia dal Mac, una volta, e il risultato si committa.

USO
    python3 scripts/build_milano_nil_geojson.py
    python3 scripts/build_milano_nil_geojson.py --url <altro-url>

Solo libreria standard. Riconosce da sé se la risorsa è GeoJSON o un CSV con
la geometria in WKT.

COSA PRODUCE
Un FeatureCollection con una feature per NIL, geometria semplificata (le
coordinate sono arrotondate e i vertici diradati: serve a disegnare una città
larga 15 km in 400 pixel, non a fare catasto), e due proprietà:
  nil   → il nome ufficiale del nucleo
  zona  → la slug del nostro elenco corto (src/lib/zones.ts), quando combacia
La mappa colora il poligono quando la sua `zona` è nell'area del professionista.
"""
import argparse, csv, io, json, os, re, sys, unicodedata
import urllib.request

CSV_URL = (
    "https://dati.comune.milano.it/dataset/e8e765fc-d882-40b8-95d8-16ff3d39eb7c/"
    "resource/3fce7202-0076-4a7b-ac2c-d2ab9b5dc658/download/ds964_nil_wm_4326.csv"
)
HERE = os.path.dirname(os.path.abspath(__file__))
ZONES_TS = os.path.join(HERE, "..", "src", "lib", "zones.ts")
OUT = os.path.join(HERE, "..", "public", "geo", "milano-nil.geojson")

# Stesso elenco corto di scripts/build_milano_zones.py: slug -> nomi NIL.
ZONES = [
    ("centro", ["DUOMO"]),
    ("brera", ["BRERA"]),
    ("isola", ["ISOLA"]),
    ("porta-nuova", ["PORTA GARIBALDI", "PORTA NUOVA"]),
    ("porta-venezia", ["BUENOS AIRES", "PORTA VENEZIA"]),
    ("porta-romana", ["PORTA ROMANA", "GUASTALLA"]),
    ("navigli", ["NAVIGLI"]),
    ("ticinese", ["TICINESE"]),
    ("sempione", ["SEMPIONE"]),
    ("citta-studi", ["CITTA STUDI", "CITTÀ STUDI"]),
    ("lambrate", ["LAMBRATE"]),
    ("bicocca", ["BICOCCA"]),
    ("bovisa", ["BOVISA"]),
    ("affori", ["AFFORI"]),
    ("niguarda", ["NIGUARDA"]),
    ("greco", ["GRECO"]),
    ("loreto", ["LORETO"]),
    ("corvetto", ["CORVETTO"]),
    ("rogoredo", ["ROGOREDO"]),
    ("barona", ["BARONA"]),
    ("famagosta", ["STADERA", "FAMAGOSTA"]),
    ("san-siro", ["SAN SIRO"]),
    ("baggio", ["BAGGIO"]),
    ("quarto-oggiaro", ["QUARTO OGGIARO"]),
    ("washington", ["WASHINGTON", "DE ANGELI"]),
    ("bande-nere", ["BANDE NERE", "LORENTEGGIO"]),
    ("forlanini", ["FORLANINI"]),
    ("gratosoglio", ["GRATOSOGLIO"]),
]


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9 ]+", " ", s).strip()


def zona_per(nome_nil):
    n = norm(nome_nil)
    for slug, alias in ZONES:
        for a in alias:
            if norm(a) in n:
                return slug
    return None


def dirada(anello, passo, cifre=5):
    """Tiene un vertice ogni `passo` e arrotonda: il file deve pesare poco."""
    if len(anello) <= 8:
        tenuti = anello
    else:
        tenuti = anello[::passo]
        if tenuti[-1] != anello[-1]:
            tenuti.append(anello[-1])
    fuori = []
    for x, y in tenuti:
        p = [round(float(x), cifre), round(float(y), cifre)]
        if not fuori or fuori[-1] != p:
            fuori.append(p)
    if fuori and fuori[0] != fuori[-1]:
        fuori.append(fuori[0])
    return fuori if len(fuori) >= 4 else None


def wkt_a_poligoni(wkt):
    """MULTIPOLYGON/POLYGON in WKT -> elenco di anelli esterni."""
    if not wkt:
        return []
    testo = wkt.strip().upper()
    if not testo.startswith(("MULTIPOLYGON", "POLYGON")):
        return []
    anelli = []
    for gruppo in re.findall(r"\(([-0-9eE., ]+)\)", wkt):
        punti = []
        for coppia in gruppo.split(","):
            pezzi = coppia.split()
            if len(pezzi) >= 2:
                punti.append((pezzi[0], pezzi[1]))
        if len(punti) >= 4:
            anelli.append(punti)
    return anelli


def da_geojson(testo):
    dati = json.loads(testo)
    out = []
    for f in dati.get("features", []):
        g = f.get("geometry") or {}
        nome = None
        for chiave, valore in (f.get("properties") or {}).items():
            if "NIL" in chiave.upper() or "NOME" in chiave.upper():
                nome = valore
                break
        anelli = []
        if g.get("type") == "Polygon":
            anelli = [g["coordinates"][0]]
        elif g.get("type") == "MultiPolygon":
            anelli = [p[0] for p in g["coordinates"]]
        out.append((nome, [[(str(x), str(y)) for x, y in a] for a in anelli]))
    return out


def da_csv(testo):
    sep = ";" if testo.count(";") > testo.count(",") else ","
    r = csv.DictReader(io.StringIO(testo), delimiter=sep)
    righe = list(r)
    if not righe:
        return []
    campi = r.fieldnames or []
    col_geo = next(
        (c for c in campi
         if any(str(righe[0].get(c, "")).strip().upper().startswith(t)
                for t in ("MULTIPOLYGON", "POLYGON"))),
        None,
    )
    if not col_geo:
        print("Colonne trovate:", campi, file=sys.stderr)
        raise SystemExit(
            "Nessuna colonna con geometria WKT. Passa --url della risorsa GeoJSON."
        )
    col_nome = next(
        (c for c in campi if "NIL" in c.upper() or "NOME" in c.upper()), campi[0]
    )
    return [(riga.get(col_nome), wkt_a_poligoni(riga.get(col_geo))) for riga in righe]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=CSV_URL)
    ap.add_argument("--passo", type=int, default=3, help="dirada un vertice ogni N")
    args = ap.parse_args()

    print("Scarico", args.url)
    testo = urllib.request.urlopen(args.url, timeout=120).read().decode("utf-8-sig")
    grezzi = da_geojson(testo) if testo.lstrip().startswith("{") else da_csv(testo)
    print("Nuclei letti:", len(grezzi))

    features, con_zona = [], 0
    for nome, anelli in grezzi:
        poligoni = [d for d in (dirada(a, args.passo) for a in anelli) if d]
        if not poligoni:
            continue
        slug = zona_per(nome)
        if slug:
            con_zona += 1
        features.append({
            "type": "Feature",
            "properties": {"nil": nome, "zona": slug},
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": [[p] for p in poligoni],
            },
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "type": "FeatureCollection",
            "attribuzione": "NIL — Comune di Milano (CC-BY)",
            "features": features,
        }, f, separators=(",", ":"))
    print(f"Scritto {OUT}: {len(features)} poligoni, {con_zona} agganciati a una zona")
    print(f"Peso: {os.path.getsize(OUT) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
