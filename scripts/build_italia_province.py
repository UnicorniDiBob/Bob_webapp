#!/usr/bin/env python3
"""L'Italia intera, una forma per provincia: lo sfondo della mappa.

PERCHÉ ESISTE
`build_confini_province.py` produce un file per provincia con dentro i suoi
comuni: 6 MB in tutto, giusti da caricare uno per volta quando si guarda quella
provincia. Ma finché si guarda una provincia sola, tutto il resto è colore di
fondo: un professionista che allarga la mappa non vede l'Italia, vede Milano
sospesa nel vuoto (segnalato il 17/09, con lo screenshot). Serve un disegno
d'insieme che si possa tenere acceso sempre, e che pesi quanto un'immagine.

PERCHÉ LE PROVINCE E NON I COMUNI
Un'Italia fatta di 7.904 comuni, anche diradata, resta un file grosso e un
groviglio di righe a zoom basso. Le 110 province danno la sagoma del paese e
abbastanza struttura interna per capire dove si è, con settanta volte meno
forme. Quando si scende di quota, sopra ci va la provincia vera, con i suoi
comuni: sono due livelli di dettaglio dello stesso disegno.

IL RIQUADRO DENTRO IL FILE
Ogni provincia porta in `b` il suo riquadro [ovest, sud, est, nord], calcolato
sulla geometria PIENA, non su quella diradata. Serve alla mappa per sapere,
senza scaricare niente, quali province stanno nell'inquadratura e quindi quali
file di comuni valga la pena chiedere. Un riquadro sbagliato per difetto
farebbe sparire dei comuni dal disegno: per questo si misura prima di tagliare.

LA FONTE
Confini provinciali ISTAT, distribuiti da openpolis/geojson-italy in CC BY 4.0
— la stessa fonte dei comuni. L'attribuzione sta nella proprietà `fonte` del
file generato, come negli altri.

LA SIGLA È LA CHIAVE
`s` è la sigla automobilistica, ed è il nome del file dei comuni
(`/geo/province/MI.geojson`). Se una sigla non ha il suo file, la mappa a zoom
alto non avrebbe i comuni: lo script lo dice alla fine invece di lasciarlo
scoprire a un professionista.

USO
    python3 scripts/build_italia_province.py
    python3 scripts/build_italia_province.py --tolleranza 0.003

Serve rete verso raw.githubusercontent.com. Solo libreria standard.
"""
import argparse
import json
import os
import urllib.request

from build_confini_province import semplifica_geometria

PROVINCE_URL = (
    "https://raw.githubusercontent.com/openpolis/geojson-italy/master/"
    "geojson/limits_IT_provinces.geojson"
)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "geo", "italia.geojson")
DIR_PROVINCE = os.path.join(HERE, "..", "public", "geo", "province")

# LA SARDEGNA, ANCORA. La fonte pubblica ha ancora le quattro province
# soppresse dalla riforma del 2016; il nostro elenco dei comuni — e quindi i
# nomi dei file — ha quelle di adesso. Le forme restano come sono (la sagoma
# dell'isola non cambia, e per uno sfondo è tutto quello che serve): cambia la
# sigla, così cliccando lì la mappa chiede il file di comuni che esiste davvero.
# Già inciampato una volta, con i codici ISTAT dei comuni sardi.
SARDEGNA = {"CI": "SU", "VS": "SU", "OG": "NU", "OT": "SS"}

FONTE = "Confini provinciali ISTAT via openpolis/geojson-italy — CC BY 4.0"

# Più grossolana di quella dei comuni (0,0005°): questo disegno si guarda da
# tutta l'Italia in una schermata, dove un grado sono una cinquantina di pixel.
# 0,002° sono circa 200 metri, cioè meno di mezzo pixel a quella scala.
TOLLERANZA = 0.002
DECIMALI = 4


def scarica(url: str):
    with urllib.request.urlopen(url, timeout=600) as risposta:
        return json.loads(risposta.read().decode("utf-8"))


def riquadro(geom: dict) -> list:
    """[ovest, sud, est, nord] della geometria piena."""
    poligoni = (
        geom["coordinates"]
        if geom["type"] == "MultiPolygon"
        else [geom["coordinates"]]
    )
    ovest = sud = 1e9
    est = nord = -1e9
    for poligono in poligoni:
        for x, y in ((p[0], p[1]) for p in poligono[0]):
            ovest, est = min(ovest, x), max(est, x)
            sud, nord = min(sud, y), max(nord, y)
    return [round(v, DECIMALI) for v in (ovest, sud, est, nord)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tolleranza", type=float, default=TOLLERANZA)
    parser.add_argument("--sorgente", help="geojson delle province già scaricato")
    argomenti = parser.parse_args()

    if argomenti.sorgente:
        print(f"leggo le province da {argomenti.sorgente}")
        with open(argomenti.sorgente, encoding="utf-8") as f:
            sorgente = json.load(f)
    else:
        print(f"scarico le province ({PROVINCE_URL.split('/')[-1]})…")
        sorgente = scarica(PROVINCE_URL)
    print(f"  {len(sorgente['features'])} province")

    # IL RIQUADRO LO DECIDE IL FILE DEI COMUNI, non la forma della provincia.
    # A che serve: la mappa, guardando un pezzo d'Italia, deve sapere quali
    # file di comuni chiedere senza scaricarli. La domanda esatta è «in questo
    # riquadro ci sono comuni di quel file?», e l'unica risposta esatta è il
    # riquadro del file stesso — non quello della forma, che dopo la riforma
    # sarda del 2016 descrive province che non esistono più (provato: con i
    # soli centri dei comuni, il nord di Seulo restava fuori da SU).
    per_sigla: dict[str, list] = {}
    for nome_file in sorted(os.listdir(DIR_PROVINCE)):
        if not nome_file.endswith(".geojson"):
            continue
        with open(os.path.join(DIR_PROVINCE, nome_file), encoding="utf-8") as f:
            dentro = json.load(f)
        r = [1e9, 1e9, -1e9, -1e9]
        for c in dentro.get("features", []):
            g = c.get("geometry")
            if not g:
                continue
            b = riquadro(g)
            r[0], r[1] = min(r[0], b[0]), min(r[1], b[1])
            r[2], r[3] = max(r[2], b[2]), max(r[3], b[3])
        if r[0] < 1e9:
            per_sigla[nome_file[:-8].upper()] = r

    uscita = []
    for f in sorgente["features"]:
        p = f.get("properties") or {}
        sigla = (p.get("prov_acr") or "").strip().upper()
        sigla = SARDEGNA.get(sigla, sigla)
        geom = f.get("geometry")
        if not sigla or not geom:
            continue
        b = riquadro(geom)
        dai_comuni = per_sigla.get(sigla)
        if dai_comuni:
            b = [
                round(min(b[0], dai_comuni[0]), DECIMALI),
                round(min(b[1], dai_comuni[1]), DECIMALI),
                round(max(b[2], dai_comuni[2]), DECIMALI),
                round(max(b[3], dai_comuni[3]), DECIMALI),
            ]
        ridotta = semplifica_geometria(geom, argomenti.tolleranza)
        if not ridotta:
            print(f"  ! {sigla} sparisce con questa tolleranza, la tengo piena")
            ridotta = geom
        uscita.append(
            {
                "type": "Feature",
                "properties": {
                    "s": sigla,
                    "n": p.get("prov_name") or sigla,
                    "r": p.get("reg_name") or "",
                    "b": b,
                },
                "geometry": ridotta,
            }
        )

    uscita.sort(key=lambda f: f["properties"]["s"])
    collezione = {"type": "FeatureCollection", "fonte": FONTE, "features": uscita}

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(collezione, f, ensure_ascii=False, separators=(",", ":"))
    peso = os.path.getsize(OUT)
    print(f"scritto {os.path.relpath(OUT, HERE)} — {len(uscita)} province, {peso/1024:.0f} KB")

    # LA PROVA: ogni sigla deve avere il suo file di comuni, se no a zoom alto
    # quella provincia resta senza dettaglio.
    presenti = {
        n[:-8].upper() for n in os.listdir(DIR_PROVINCE) if n.endswith(".geojson")
    }
    sigle = {f["properties"]["s"] for f in uscita}
    senza_file = sorted(sigle - presenti)
    senza_sfondo = sorted(presenti - sigle)
    if senza_file:
        print(f"  ! {len(senza_file)} province senza file di comuni: {', '.join(senza_file)}")
    if senza_sfondo:
        print(f"  ! {len(senza_sfondo)} file di comuni senza provincia nello sfondo: {', '.join(senza_sfondo)}")
    if not senza_file and not senza_sfondo:
        print(f"  ok: tutte e {len(sigle)} le sigle hanno il loro file di comuni")


if __name__ == "__main__":
    main()
