#!/usr/bin/env python3
"""Genera roadmap.md e roadmap.html dalle fonti di verità in questa cartella.

Fonti (le uniche cose da modificare a mano):
    milestones.csv   i traguardi: titolo, finestra, perché, "è fatto quando"
    roadmap.csv      il lavoro aperto, una riga per attività, con la colonna milestone
    findings.csv     il pannello "controllo di realtà" (opzionale)
    next.csv         le prossime mosse in ordine, con i comandi (opzionale)
    ARCHIVE.csv      lo storico chiuso — non si modifica, ci si sposta dentro

Output (generati, non modificare a mano):
    roadmap.md       versione leggibile, sincronizzata nel progetto Claude
    roadmap.html     la vista per traguardi (timeline, filtri, test di completamento)

Uso:  python3 roadmap/build_roadmap.py
Nessuna dipendenza esterna: solo la libreria standard.
"""
import csv, html, json, os, sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
def P(n): return os.path.join(HERE, n)

# ---------------------------------------------------------------- lettura
def read(name, required=True):
    p = P(name)
    if not os.path.exists(p):
        if required: sys.exit(f"manca {name}")
        return []
    with open(p, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if any(v.strip() for v in r.values())]

MS      = read("milestones.csv")
ITEMS   = read("roadmap.csv")
ARCHIVE = read("ARCHIVE.csv", required=False)
FIND    = read("findings.csv", required=False)
NEXT    = read("next.csv", required=False)

ORDER = [m["id"] for m in MS]
BY_MS = {m["id"]: m for m in MS}
for it in ITEMS:
    if it["milestone"] not in BY_MS:
        sys.exit(f"riga {it['id']}: milestone sconosciuto {it['milestone']!r}")

# stati ammessi. "Milestone" non è più uno stato: i traguardi sono contenitori.
STATES = {
    "Open":        ("open",    "○", "Aperto"),
    "In progress": ("prog",    "▸", "In corso"),
    "Gate":        ("gate",    "◆", "Decisione"),
    "Dormant":     ("dormant", "◑", "Pronto ma spento"),
    "Parked":      ("park",    "▪", "Parcheggiato"),
}
for it in ITEMS:
    if it["status"] not in STATES:
        sys.exit(f"riga {it['id']}: stato non ammesso {it['status']!r} "
                 f"(ammessi: {', '.join(STATES)})")

# Stati ammessi per i TRAGUARDI. Devono restare allineati alla mappa MSTATE in
# view_template.html: se qui passa uno stato che la vista non conosce, la vista
# non si lamenta - ripiega su MSTATE.open e disegna "Non iniziato". Il 9 agosto
# M1 e' stata chiusa e per un attimo la pagina l'ha mostrata come non iniziata,
# che e' esattamente il tipo di bugia silenziosa che questa roadmap esiste per
# non raccontare. Quindi qui si muore, invece di ripiegare.
MSTATES = ("done", "blocked", "urgent", "active", "open", "gate", "parallel", "parked")
for m in MS:
    if m["state"] not in MSTATES:
        sys.exit(f"traguardo {m['id']}: stato non ammesso {m['state']!r} "
                 f"(ammessi: {', '.join(MSTATES)}). "
                 f"Se ne aggiungi uno, aggiungilo anche a MSTATE in view_template.html.")

# Il badge di un traguardo lo scrive una persona (milestones.csv), la barra di
# avanzamento la conta il generatore dalle attivita'. Possono divergere: il 9
# agosto M1 mostrava "Chiuso" accanto a "4/5 chiuse", perche' i cancelli erano
# passati ma una riga era rimasta aperta. Non e' sempre un errore - un traguardo
# puo' chiudersi sui suoi test e lasciare una coda - ma va detto, non scoperto
# guardando la pagina.
def _avvisa_traguardi_incoerenti():
    for m in MS:
        if m["state"] != "done":
            continue
        aperte = [i["id"] for i in ITEMS if i["milestone"] == m["id"]]
        if aperte:
            print(f"  avviso: {m['id']} e' 'done' ma ha ancora attivita' aperte: "
                  f"{', '.join(aperte)} - chiudile o spiega perche' restano")

def items_of(mid):  return [i for i in ITEMS   if i["milestone"] == mid]
def archive_of(mid):return [a for a in ARCHIVE if a["milestone"] == mid]

TODAY = date.today().isoformat()

# ---------------------------------------------------------------- markdown
ICON = {"Open": "⬜", "In progress": "🔵", "Gate": "🔶", "Dormant": "🌙", "Parked": "▪️"}

def write_md():
    n_open = sum(1 for i in ITEMS if i["status"] in ("Open", "In progress"))
    L = ["# BOB — Roadmap per traguardi", "",
         "_Generato da `milestones.csv` + `roadmap.csv` — non modificare a mano. "
         "Aggiorna i CSV, rilancia `python3 roadmap/build_roadmap.py` e committa "
         "il risultato: la CI verifica che corrisponda ai CSV, non lo rigenera._", "",
         f"**Stato:** {n_open} attività aperte · "
         f"{sum(1 for i in ITEMS if i['status']=='Dormant')} pronte ma spente · "
         f"{sum(1 for i in ITEMS if i['status']=='Parked')} parcheggiate · "
         f"{len(ARCHIVE)} chiuse (in `ARCHIVE.csv`)", "",
         "**Track:** Client/Pro → André · Internal → Lucio · Shared", ""]
    if FIND:
        L += ["## Controllo di realtà", ""]
        for f in FIND:
            L += [f"**{f['title']}** — _{f['label']}_", "", f"{f['body']}", ""]
    for m in MS:
        its, arc = items_of(m["id"]), archive_of(m["id"])
        window = f"{m['start']} → {m['end']}" if m["start"] else "continuo"
        L += ["", f"## {m['id']} · {m['title']}", "",
              f"**Finestra:** {window} · **{len(its)} aperte, {len(arc)} chiuse**", "",
              f"**Perché:** {m['why']}", "",
              f"**È fatto quando:** {m['done_when']}", ""]
        if its:
            L += ["| # | Attività | Track | Owner | Stato | Periodo |",
                  "|---|----------|-------|-------|-------|---------|"]
            for i in its:
                per = f"{i['start']} → {i['end']}" if i["start"] else "—"
                L.append(f"| {i['id']} | {i['task']} | {i['track']} | {i['owner']} | "
                         f"{ICON[i['status']]} {STATES[i['status']][2]} | {per} |")
            L.append("")
        if arc:
            L += [f"<details><summary>{len(arc)} attività già chiuse</summary>", "",
                  "| # | Attività | Owner | Chiusa il |", "|---|----------|-------|-----------|"]
            for a in arc:
                L.append(f"| {a['id']} | {a['task']} | {a['owner']} | {a['done_on']} |")
            L += ["", "</details>", ""]
    L += ["", "---", "",
          "### Le quattro regole", "",
          "1. **Un traguardo è uno stato del mondo, mai un contenitore di attività.** "
          "Se non riesci a scrivere «è fatto quando una persona vera può…», è un tema, e i temi non finiscono mai.",
          "2. **Due livelli, e niente sotto la giornata prende una riga.** "
          "Traguardo → attività. Il lavoro da mezz'ora sta nel log dei commit, che già lo traccia.",
          "3. **Nessuna data senza una dipendenza o un orologio esterno.** Altrimenti va nel parcheggio.",
          "4. **Quello che è costruito ma spento si scrive `Dormant`, non `Done`,** con la condizione che lo accende. "
          "«Done» deve continuare a voler dire «funziona per un utente».", ""]
    open(P("roadmap.md"), "w", encoding="utf-8").write("\n".join(L))

# ---------------------------------------------------------------- html
def month_index(iso, base=(2026, 8)):
    y, m = int(iso[:4]), int(iso[5:7])
    return (y - base[0]) * 12 + (m - base[1])

def build_payload():
    ms = []
    for m in MS:
        its = [{"id": i["id"], "task": i["task"], "owner": i["owner"], "track": i["track"],
                "status": i["status"], "cls": STATES[i["status"]][0],
                "glyph": STATES[i["status"]][1], "lab": STATES[i["status"]][2],
                "start": i["start"], "end": i["end"], "parent": i.get("parent", "")}
               for i in items_of(m["id"])]
        arc = [{"id": a["id"], "task": a["task"], "owner": a["owner"], "done_on": a["done_on"]}
               for a in archive_of(m["id"])]
        ms.append({"id": m["id"], "kind": m["kind"], "title": m["title"], "state": m["state"],
                   "start": m["start"], "end": m["end"], "why": m["why"],
                   "done_when": m["done_when"], "items": its, "archive": arc,
                   "a": month_index(m["start"]) if m["start"] else 0,
                   "b": month_index(m["end"]) + 1 if m["end"] else 18})
    return {"generated": TODAY, "milestones": ms,
            "findings": [{"sev": f["severity"], "label": f["label"], "title": f["title"],
                          "body": f["body"], "ev": f["evidence"]} for f in FIND],
            "next": [{"h": n["title"], "p": n["body"], "code": n["code"]} for n in NEXT],
            "totals": {"open": sum(1 for i in ITEMS if i["status"] in ("Open", "In progress")),
                       "dormant": sum(1 for i in ITEMS if i["status"] == "Dormant"),
                       "parked": sum(1 for i in ITEMS if i["status"] == "Parked"),
                       "closed": len(ARCHIVE)}}

def write_html():
    tpl = open(P("view_template.html"), encoding="utf-8").read()
    payload = json.dumps(build_payload(), ensure_ascii=False, separators=(",", ":"))
    out = tpl.replace("/*__DATA__*/null", payload)
    open(P("roadmap.html"), "w", encoding="utf-8").write(out)

if __name__ == "__main__":
    write_md()
    write_html()
    t = build_payload()["totals"]
    print(f"roadmap.md e roadmap.html rigenerati — {t['open']} aperte, "
          f"{t['dormant']} spente, {t['parked']} parcheggiate, {t['closed']} chiuse")

_avvisa_traguardi_incoerenti()
