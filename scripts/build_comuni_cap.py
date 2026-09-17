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
src/lib/data/comuni-italia.json, che NON viene mai importato da un componente
del browser: lo legge solo /api/geo/comuni, lato server. Sono 7.900 comuni: nel
pacchetto del browser sarebbero quasi un megabyte per un campo di ricerca.

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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    argomenti = parser.parse_args()

    dati = costruisci()
    milano = next(c for c in dati["comuni"] if c["i"] == "015146")
    print(f"controllo — Milano: {len(milano['c'])} CAP, {milano.get('lat')},{milano.get('lng')}")

    if argomenti.dry_run:
        return
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"scritto {os.path.relpath(OUT)} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
