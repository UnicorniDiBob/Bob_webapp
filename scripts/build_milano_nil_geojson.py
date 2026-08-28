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
    python3 scripts/build_milano_nil_geojson.py --url <indirizzo-specifico>
    python3 scripts/build_milano_nil_geojson.py --elenca   # cosa offre il portale

Solo libreria standard. Lo script CERCA DA SÉ la risorsa giusta interrogando
l'API del portale (CKAN): il dataset dei NIL pubblica più formati, e quello
scaricato al primo tentativo — ds964_nil_wm_4326.csv — contiene soltanto i
centroidi (colonne LONG_X_4326_CENTROID, LAT_Y_4326_CENTROID), non i perimetri.
Se non trova nulla di utile, stampa l'elenco delle risorse invece di fallire in
silenzio.

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
            "Questa risorsa non ha geometrie: sono soltanto i centroidi, che "
            "abbiamo già.\nLancia  python3 scripts/build_milano_nil_geojson.py "
            "--elenca  e manda l'elenco."
        )
    col_nome = next(
        (c for c in campi if "NIL" in c.upper() or "NOME" in c.upper()), campi[0]
    )
    return [(riga.get(col_nome), wkt_a_poligoni(riga.get(col_geo))) for riga in righe]


API_PACCHETTO = (
    "https://dati.comune.milano.it/api/3/action/package_show?id="
    "e8e765fc-d882-40b8-95d8-16ff3d39eb7c"
)
API_RICERCA = (
    "https://dati.comune.milano.it/api/3/action/package_search?q=NIL+nuclei&rows=20"
)


def leggi(url, timeout=120):
    return urllib.request.urlopen(url, timeout=timeout).read().decode("utf-8-sig")


def risorse_del_pacchetto(url_api):
    """Elenco (formato, nome, url) delle risorse di un pacchetto CKAN."""
    try:
        dati = json.loads(leggi(url_api, 60))
    except Exception as e:
        print("  (API non raggiungibile:", e, ")", file=sys.stderr)
        return []
    pacchetto = dati.get("result") or {}
    if isinstance(pacchetto, list):
        pacchetto = pacchetto[0] if pacchetto else {}
    out = []
    for r in pacchetto.get("resources", []):
        out.append((
            (r.get("format") or "").upper(),
            r.get("name") or "",
            r.get("url") or "",
        ))
    return out


def scegli_geometrica(risorse):
    """La prima risorsa che promette geometrie: GeoJSON, poi GML, poi KML."""
    def punteggio(r):
        formato, nome, url = r
        testo = f"{formato} {nome} {url}".upper()
        if "GEOJSON" in testo or url.lower().endswith(".geojson"):
            return 3
        if "GML" in testo:
            return 2
        if "KML" in testo:
            return 1
        return 0
    candidate = sorted(risorse, key=punteggio, reverse=True)
    return candidate[0] if candidate and punteggio(candidate[0]) > 0 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=None)
    ap.add_argument("--passo", type=int, default=3, help="dirada un vertice ogni N")
    ap.add_argument("--elenca", action="store_true", help="mostra le risorse e esci")
    args = ap.parse_args()

    if args.elenca:
        print("Risorse del dataset NIL:")
        for formato, nome, url in risorse_del_pacchetto(API_PACCHETTO):
            print(f"  [{formato or '?'}] {nome}\n      {url}")
        print("\nSe qui non c'è un GeoJSON, cerco anche fra i dataset simili:")
        try:
            dati = json.loads(leggi(API_RICERCA, 60))
            for p in (dati.get("result") or {}).get("results", []):
                print(f"  · {p.get('title')}  (id {p.get('id')})")
        except Exception as e:
            print("  (ricerca non riuscita:", e, ")")
        return

    url = args.url
    if not url:
        print("Cerco la risorsa con le geometrie sul portale…")
        risorse = risorse_del_pacchetto(API_PACCHETTO)
        for formato, nome, u in risorse:
            print(f"  [{formato or '?'}] {nome or u.rsplit('/', 1)[-1]}")
        scelta = scegli_geometrica(risorse)
        if scelta:
            print(f"Uso la risorsa [{scelta[0]}] {scelta[1]}")
            url = scelta[2]
        else:
            print(
                "\nNessuna risorsa con geometrie in questo dataset.\n"
                "Lancia:  python3 scripts/build_milano_nil_geojson.py --elenca\n"
                "e passami l'elenco: cerchiamo il dataset giusto insieme.\n"
                "Ripiego intanto sul CSV noto, per vedere cosa contiene.",
                file=sys.stderr,
            )
            url = CSV_URL

    print("Scarico", url)
    testo = leggi(url)
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
