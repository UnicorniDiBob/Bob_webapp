#!/usr/bin/env python3
"""Aiuto alla manutenzione del tracker: incrocia i commit git con roadmap.csv.

- Elenca i commit recenti con data e autore.
- Se un messaggio di commit contiene un id fra parentesi, es. "feat(8.9): ...",
  segnala se quel task nel CSV è ancora 'Planned' (da aggiornare a Done) o manca.
Non modifica nulla: stampa solo suggerimenti.

Uso:  python3 sync_status.py [numero_commit]   # default 40
"""
import csv, os, re, subprocess, sys

HERE=os.path.dirname(os.path.abspath(__file__))
CSV=os.path.join(HERE,"roadmap.csv")
N=int(sys.argv[1]) if len(sys.argv)>1 else 40

def load():
    with open(CSV,encoding="utf-8") as f:
        return {r["id"]:r for r in csv.DictReader(f) if r["kind"]!="section"}

def git_log(n):
    out=subprocess.run(["git","log",f"-{n}","--date=short",
        "--pretty=format:%ad\t%an\t%s"],cwd=HERE,capture_output=True,text=True)
    return [l.split("\t",2) for l in out.stdout.splitlines() if l.strip()]

def main():
    tasks=load()
    print(f"Ultimi {N} commit:\n")
    idpat=re.compile(r"\(([0-9]+[a-z]?(?:\.[0-9]+[a-z]?)?)\)")
    flagged=[]
    for date,author,subj in git_log(N):
        print(f"  {date}  {author:<10}  {subj[:80]}")
        for tid in idpat.findall(subj):
            if tid in tasks:
                st=tasks[tid]["status"]
                if st!="Done":
                    flagged.append((tid,st,date,subj[:50]))
            # id non nel CSV: potrebbe essere un nuovo task da aggiungere
    if flagged:
        print("\n⚠  Task con commit ma non ancora 'Done' nel CSV:")
        for tid,st,date,subj in flagged:
            print(f"   [{tid}] stato={st}  ({date})  {subj}")
        print("\n   → aggiorna status=Done e done_on nel CSV, poi: python3 build_roadmap.py")
    else:
        print("\n✓  Nessun disallineamento evidente fra commit e CSV.")
    # riepilogo stato
    from collections import Counter
    c=Counter(t["status"] for t in tasks.values())
    print("\nRiepilogo stato:", dict(c))

if __name__=="__main__":
    main()
