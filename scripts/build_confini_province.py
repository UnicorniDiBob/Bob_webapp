#!/usr/bin/env python3
"""I confini dei comuni, un file per provincia, per disegnare l'Italia.

PERCHÉ ESISTE
La mappa dell'area di lavoro sa disegnare solo Milano: `public/geo/milano-nil.geojson`
sono i perimetri dei suoi 88 nuclei. Fuori non c'è niente, e un professionista
di Monza o di Bergamo vedrebbe dei pallini sospesi nel vuoto — è esattamente il
problema già incontrato il 28/08 dentro Milano («non si vede proprio Milano
sotto»), su scala nazionale.

PERCHÉ UN FILE PER PROVINCIA E NON UNO SOLO
I confini di tutti i comuni italiani sono decine di megabyte: spedirli al
browser per far scegliere l'area a un idraulico sarebbe assurdo. Una provincia
è l'unità che si guarda davvero quando si disegna un raggio di lavoro, e pesa
qualche decina di chilobyte. La mappa carica quella che serve, quando serve.

NIENTE TILE, COME PRIMA
Stessa scelta della 057 e della mappa di Milano: nessun fornitore di tile,
nessuna richiesta a terzi, quindi nessun indirizzo IP del professionista che
esce da Bob mentre guarda dove lavora. I file stanno sul nostro dominio.

LA FONTE
Confini comunali ISTAT, distribuiti da openpolis/geojson-italy in CC BY 4.0.
Attribuzione dovuta: sta dentro ogni file generato, nella proprietà `fonte`, e
in docs/NOTE_E_DECISIONI.md. Il dato è pubblico e non riguarda nessuna persona.

LA SEMPLIFICAZIONE, E PERCHÉ NON È UN DETTAGLIO
Un confine comunale pubblicato per il catasto ha migliaia di vertici; una mappa
larga 400 pixel ne usa qualche decina. Si diradano con Douglas-Peucker (non
prendendo «un punto ogni N», che sui confini frastagliati taglia i promontori e
lascia i rettilinei) e si arrotondano a quattro decimali, circa undici metri.
La forma resta riconoscibile, il file diventa leggibile in rete.

LA PROVA CHE IL FILE SERVA DAVVERO
Alla fine lo script controlla che il centro di ogni comune — quello che usiamo
per dire «questo comune cade nel cerchio», che viene da un ALTRO elenco — cada
dentro il suo poligono. È il modo per accorgersi subito se i due dati parlano
di due Italie diverse: un centro fuori dal suo confine vuol dire coordinate
sbagliate, e un professionista mandato dall'altra parte della provincia.

USO
    python3 scripts/build_confini_province.py
    python3 scripts/build_confini_province.py --solo MI,MB,BG
    python3 scripts/build_confini_province.py --tolleranza 0.0008

Serve rete verso raw.githubusercontent.com. Solo libreria standard.
"""
import argparse
import json
import math
import os
import re
import unicodedata
import urllib.request

CONFINI_URL = (
    "https://raw.githubusercontent.com/openpolis/geojson-italy/master/"
    "geojson/limits_IT_municipalities.geojson"
)
HERE = os.path.dirname(os.path.abspath(__file__))
COMUNI_JSON = os.path.join(HERE, "..", "src", "lib", "data", "comuni-italia.json")
OUT_DIR = os.path.join(HERE, "..", "public", "geo", "province")

FONTE = "Confini comunali ISTAT via openpolis/geojson-italy — CC BY 4.0"

# Tolleranza di Douglas-Peucker, in gradi. 0,0005° sono circa 55 metri alla
# latitudine dell'Italia: sotto la larghezza di un isolato, invisibile su una
# mappa di provincia, e taglia via il 90% dei vertici.
TOLLERANZA = 0.0005
DECIMALI = 4


def piatto(testo: str) -> str:
    """Un nome ridotto all'osso, per confrontarlo senza incidenti."""
    senza = unicodedata.normalize("NFKD", testo).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", senza.lower())


def scarica(url: str):
    with urllib.request.urlopen(url, timeout=600) as risposta:
        return json.loads(risposta.read().decode("utf-8"))


def distanza_dal_segmento(p, a, b) -> float:
    """Distanza perpendicolare del punto p dal segmento a-b, in gradi."""
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def douglas_peucker(punti: list, tolleranza: float) -> list:
    if len(punti) < 3:
        return punti
    primo, ultimo = punti[0], punti[-1]
    massimo, indice = 0.0, 0
    for i in range(1, len(punti) - 1):
        d = distanza_dal_segmento(punti[i], primo, ultimo)
        if d > massimo:
            massimo, indice = d, i
    if massimo <= tolleranza:
        return [primo, ultimo]
    sinistra = douglas_peucker(punti[: indice + 1], tolleranza)
    destra = douglas_peucker(punti[indice:], tolleranza)
    return sinistra[:-1] + destra


def semplifica_anello(anello: list, tolleranza: float) -> list:
    ridotto = douglas_peucker([tuple(p[:2]) for p in anello], tolleranza)
    ridotto = [[round(x, DECIMALI), round(y, DECIMALI)] for x, y in ridotto]
    # Un anello deve restare chiuso, o il disegno si apre.
    if ridotto and ridotto[0] != ridotto[-1]:
        ridotto.append(ridotto[0])
    return ridotto if len(ridotto) >= 4 else []


def semplifica_geometria(geom: dict, tolleranza: float) -> dict | None:
    tipo = geom["type"]
    if tipo == "Polygon":
        anelli = [semplifica_anello(a, tolleranza) for a in geom["coordinates"]]
        anelli = [a for a in anelli if a]
        return {"type": "Polygon", "coordinates": anelli} if anelli else None
    if tipo == "MultiPolygon":
        poligoni = []
        for poligono in geom["coordinates"]:
            anelli = [semplifica_anello(a, tolleranza) for a in poligono]
            anelli = [a for a in anelli if a]
            if anelli:
                poligoni.append(anelli)
        return {"type": "MultiPolygon", "coordinates": poligoni} if poligoni else None
    return None


def dentro_poligono(punto, geom: dict) -> bool:
    """Punto dentro il poligono (ray casting), buchi compresi."""
    x, y = punto
    poligoni = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poligono in poligoni:
        if not poligono:
            continue
        if not dentro_anello(x, y, poligono[0]):
            continue
        if any(dentro_anello(x, y, buco) for buco in poligono[1:]):
            continue
        return True
    return False


def dentro_anello(x: float, y: float, anello: list) -> bool:
    dentro = False
    for i in range(len(anello) - 1):
        x1, y1 = anello[i][0], anello[i][1]
        x2, y2 = anello[i + 1][0], anello[i + 1][1]
        if (y1 > y) != (y2 > y):
            taglio = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if taglio > x:
                dentro = not dentro
    return dentro


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--solo", help="sigle separate da virgola, es. MI,MB")
    parser.add_argument("--tolleranza", type=float, default=TOLLERANZA)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--sorgente",
        help="percorso di un geojson dei confini gia' scaricato, invece della rete",
    )
    argomenti = parser.parse_args()

    solo = (
        {s.strip().upper() for s in argomenti.solo.split(",")}
        if argomenti.solo
        else None
    )

    with open(COMUNI_JSON, encoding="utf-8") as f:
        elenco = json.load(f)["comuni"]
    per_istat = {c["i"]: c for c in elenco}

    if argomenti.sorgente:
        print(f"leggo i confini da {argomenti.sorgente}")
        with open(argomenti.sorgente, encoding="utf-8") as f:
            confini = json.load(f)
    else:
        print(f"scarico i confini ({CONFINI_URL.split('/')[-1]})…")
        confini = scarica(CONFINI_URL)
    print(f"  {len(confini['features'])} comuni")

    # I CODICI ISTAT DELLA SARDEGNA NON COMBACIANO, e non e' un errore di
    # nessuno dei due: le province sarde sono state rifatte, e il codice del
    # comune comincia col codice della provincia. Stesso paese, due numeri.
    # Sono 377 comuni: appaiarli per nome e regione li recupera tutti, e senza
    # questo pezzo mezza Sardegna resterebbe senza confini.
    per_nome = {}
    for c in elenco:
        per_nome[(piatto(c["n"]), piatto(c["r"]))] = c

    # Il file dei confini scrive il codice ISTAT senza gli zeri davanti.
    province: dict[str, list] = {}
    senza_anagrafica = 0
    for f in confini["features"]:
        p = f["properties"]
        codice = str(p.get("com_istat_code") or p.get("com_istat_code_num") or "").zfill(6)
        anagrafica = per_istat.get(codice)
        if anagrafica is None:
            anagrafica = per_nome.get(
                (piatto(p.get("name") or ""), piatto(p.get("reg_name") or ""))
            )
        if anagrafica is None:
            senza_anagrafica += 1
            continue
        codice = anagrafica["i"]
        sigla = anagrafica["s"].upper()
        if solo and sigla not in solo:
            continue
        geom = semplifica_geometria(f["geometry"], argomenti.tolleranza)
        if geom is None:
            continue
        province.setdefault(sigla, []).append(
            {
                "type": "Feature",
                "properties": {"i": codice, "n": anagrafica["n"]},
                "geometry": geom,
            }
        )

    if senza_anagrafica:
        print(f"  {senza_anagrafica} comuni dei confini non stanno nel nostro elenco (fusioni recenti)")

    # E il contrario: comuni che abbiamo in elenco e di cui non sappiamo la
    # forma. Vanno detti, non nascosti: sulla mappa resteranno un pallino.
    disegnati = {f["properties"]["i"] for el in province.values() for f in el}
    senza_forma = [c for c in elenco if c["i"] not in disegnati and (not solo or c["s"].upper() in solo)]
    if senza_forma:
        nomi = ", ".join(c["n"] for c in senza_forma[:10])
        print(f"  {len(senza_forma)} comuni del nostro elenco restano senza confine: {nomi}")

    # LA PROVA: il centro di ogni comune deve cadere dentro il suo confine.
    # I due dati vengono da fonti diverse, e se non parlano della stessa Italia
    # e' qui che si vede, non quando un professionista viene mandato altrove.
    dentro = fuori = senza_punto = 0
    fuori_elenco = []
    for sigla, elementi in province.items():
        for feature in elementi:
            anagrafica = per_istat[feature["properties"]["i"]]
            if anagrafica.get("lat") is None:
                senza_punto += 1
                continue
            punto = (anagrafica["lng"], anagrafica["lat"])
            if dentro_poligono(punto, feature["geometry"]):
                dentro += 1
            else:
                fuori += 1
                if len(fuori_elenco) < 12:
                    fuori_elenco.append(f"{anagrafica['n']} ({sigla})")

    totale = dentro + fuori
    quota = (dentro / totale * 100) if totale else 0
    print(f"\ncentri dentro il proprio confine: {dentro}/{totale} ({quota:.1f}%)")
    if senza_punto:
        print(f"  {senza_punto} comuni non hanno un centro da controllare")
    if fuori_elenco:
        print(f"  fuori, i primi: {', '.join(fuori_elenco)}")

    if argomenti.dry_run:
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    peso = 0
    for sigla, elementi in sorted(province.items()):
        percorso = os.path.join(OUT_DIR, f"{sigla}.geojson")
        with open(percorso, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "type": "FeatureCollection",
                    "fonte": FONTE,
                    "features": elementi,
                },
                f,
                ensure_ascii=False,
                separators=(",", ":"),
            )
            f.write("\n")
        peso += os.path.getsize(percorso)

    print(f"\nscritte {len(province)} province in {os.path.relpath(OUT_DIR)}")
    print(f"peso totale {peso // 1024} KB, media {peso // max(len(province), 1) // 1024} KB")


if __name__ == "__main__":
    main()
