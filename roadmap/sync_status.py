#!/usr/bin/env python3
"""Aiuto alla manutenzione del tracker: incrocia i commit git con roadmap.csv.

- Elenca i commit recenti con data e autore.
- Se un messaggio di commit contiene un id fra parentesi, es. "feat(8.9): ...",
  segnala se quell'attività è ancora aperta nel CSV (da spostare in ARCHIVE.csv)
  oppure se l'id non esiste da nessuna parte (nuova attività da aggiungere).
- Controlla le regole dello schema: stati ammessi, milestone esistenti,
  attività aperte senza data quando il traguardo ne ha una, id duplicati.

Non modifica nulla: stampa solo suggerimenti.

Uso:  python3 roadmap/sync_status.py [numero_commit]   # default 40
"""
import csv, os, re, subprocess, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 40
STATES = {"Open", "In progress", "Gate", "Dormant", "Parked"}

def load(name):
    p = os.path.join(HERE, name)
    if not os.path.exists(p): return []
    with open(p, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if any(v.strip() for v in r.values())]

def git_log(n):
    out = subprocess.run(["git", "log", f"-{n}", "--date=short",
                          "--pretty=format:%ad\t%an\t%s"],
                         cwd=HERE, capture_output=True, text=True)
    return [l.split("\t", 2) for l in out.stdout.splitlines() if l.strip()]

def main():
    items   = load("roadmap.csv")
    archive = load("ARCHIVE.csv")
    ms      = {m["id"] for m in load("milestones.csv")}
    open_ids = {r["id"]: r for r in items}
    done_ids = {r["id"] for r in archive}

    print(f"Ultimi {N} commit:\n")
    idpat = re.compile(r"\(([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?)\)")
    flagged, unknown = [], []
    for date, author, subj in git_log(N):
        print(f"  {date}  {author:<10}  {subj[:80]}")
        for tid in idpat.findall(subj):
            if tid in open_ids:
                st = open_ids[tid]["status"]
                # Dormant e Parked non sono disallineamenti: sono stati voluti.
                if st in ("Open", "In progress"):
                    flagged.append((tid, st, date, subj[:50]))
            elif tid not in done_ids and re.match(r"^\d+\.", tid):
                # solo id con un punto: "043" in un messaggio è il numero di una
                # migrazione, non un'attività del tracker.
                unknown.append((tid, date, subj[:50]))

    if flagged:
        print("\n[!] Attività con un commit ma ancora aperte nel CSV:")
        for tid, st, date, subj in flagged:
            print(f"    [{tid}] stato={st}  ({date})  {subj}")
        print("\n    -> spostale in ARCHIVE.csv con la data di chiusura, poi:"
              " python3 roadmap/build_roadmap.py")
    if unknown:
        print("\n[?] Id citati nei commit e assenti dal tracker (nuove attività?):")
        for tid, date, subj in unknown:
            print(f"    [{tid}]  ({date})  {subj}")

    # ---- controlli sullo schema -------------------------------------------
    problems = []
    seen = Counter(r["id"] for r in items)
    problems += [f"id duplicato: {i}" for i, n in seen.items() if n > 1]
    for r in items:
        if r["status"] not in STATES:
            problems.append(f"{r['id']}: stato non ammesso {r['status']!r}")
        if r["milestone"] not in ms:
            problems.append(f"{r['id']}: milestone sconosciuto {r['milestone']!r}")
        if r["status"] in ("Open", "In progress") and not r["end"]:
            problems.append(f"{r['id']}: attività aperta senza data di fine "
                            f"(o le dai una data, o la sposti in PARK)")
    both = set(open_ids) & done_ids
    problems += [f"{i}: presente sia in roadmap.csv sia in ARCHIVE.csv" for i in both]

    if problems:
        print("\n[X] Problemi di schema:")
        for p in problems: print("    " + p)
    elif not flagged and not unknown:
        print("\n[ok] Nessun disallineamento evidente.")

    print("\nRiepilogo:", dict(Counter(r["status"] for r in items)),
          f"· {len(archive)} chiuse in archivio")
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
