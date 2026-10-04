"use client";

// I RICAVI ESTERNI: il lavoro fatto fuori da Bob, scritto dal pro (mig 111,
// spec §4). Plus e Business li scrivono; tutti li vedono, li scaricano e li
// cancellano, anche dopo essere tornati al Free: sono dati loro.
//
// SEPARATI DA BOB. Li legge solo il pro (RLS, nessuna policy per lo staff), e
// nelle Analisi entrano solo con «tutto il mio lavoro». Il test
// src/lib/ricaviEsterniSeparati.test.ts tiene il nome della tabella fuori da
// tutto il resto del codice.
//
// IL CLIENTE E' UN CODICE (§4.3), veloce da scrivere (Lucio, 04/10): il campo
// propone i codici gia' usati, dal piu' recente, e il bottone «Cliente
// nuovo» scrive da solo il numero dopo l'ultimo.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SceltaComune, { type ComuneScelto } from "@/components/SceltaComune";
import { SchedeNumeri } from "@/components/analisi/SchedeNumeri";
import {
  leggiCsv,
  normalizza,
  prossimoCodice,
  trovaServizio,
  type EsitoCsv,
  type RigaLetta,
} from "@/lib/csvRicavi";

interface Riga {
  id: number;
  data_lavoro: string;
  importo_cent: number;
  service_id: string | null;
  comune_istat: string | null;
  postal_code: string | null;
  codice_cliente: string | null;
  nota: string | null;
  origine: "manuale" | "csv";
  lotto_import: string | null;
  creato_al: string;
}

interface Servizio {
  id: string;
  name: string;
}

const LIMITE_ELENCO = 500;

const euro = (cent: number) =>
  (cent / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const giorno = (iso: string) => {
  const [a, m, g] = iso.split("-");
  return `${g}/${m}/${a}`;
};

const oggiIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

/** Le righe che la prossima condensazione (il 2 del mese) riassumera'. */
function sogliaCondensazione(): string {
  const [a, m] = oggiIso().split("-").map(Number);
  const t = a * 12 + (m - 1) - 24;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}

interface RigaPronta extends RigaLetta {
  serviceId: string | null;
  comuneIstat: string | null;
}

export function RicaviEsterni({
  proId,
  piano,
  servizi,
}: {
  proId: string;
  piano: string;
  servizi: Servizio[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const puoScrivere = piano === "pro" || piano === "business";

  const [righe, setRighe] = useState<Riga[]>([]);
  const [totale, setTotale] = useState(0);
  const [nomiComuni, setNomiComuni] = useState<Record<string, string>>({});
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  // modulo
  const [data, setData] = useState(oggiIso());
  const [importo, setImporto] = useState("");
  const [servizio, setServizio] = useState("");
  const [comune, setComune] = useState<ComuneScelto | null>(null);
  const [cap, setCap] = useState("");
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);

  // csv
  const [csv, setCsv] = useState<(EsitoCsv & { pronte: RigaPronta[] }) | null>(null);
  const [saltaDoppioni, setSaltaDoppioni] = useState(true);
  const [preparando, setPreparando] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nomeServizio = useCallback(
    (id: string | null) => servizi.find((s) => s.id === id)?.name ?? "—",
    [servizi]
  );

  const carica = useCallback(async () => {
    setCaricando(true);
    const { data: d, count, error } = await supabase
      .from("ricavi_esterni")
      .select(
        "id, data_lavoro, importo_cent, service_id, comune_istat, postal_code, codice_cliente, nota, origine, lotto_import, creato_al",
        { count: "exact" }
      )
      .eq("professional_id", proId)
      .order("data_lavoro", { ascending: false })
      .order("id", { ascending: false })
      .limit(LIMITE_ELENCO);
    if (error) {
      setErrore("Non riesco a leggere i tuoi ricavi esterni. Ricarica la pagina.");
      setCaricando(false);
      return;
    }
    const elenco = (d ?? []) as Riga[];
    setRighe(elenco);
    setTotale(count ?? elenco.length);
    const istat = Array.from(new Set(elenco.map((r) => r.comune_istat).filter(Boolean))) as string[];
    if (istat.length) {
      const { data: c } = await supabase.from("comuni").select("istat, nome").in("istat", istat);
      setNomiComuni(Object.fromEntries((c ?? []).map((x) => [x.istat as string, x.nome as string])));
    }
    setCaricando(false);
  }, [proId, supabase]);

  useEffect(() => {
    carica();
  }, [carica]);

  // I codici gia' usati, dal piu' recente: la prima proposta e' quella giusta
  // nove volte su dieci.
  const codiciUsati = useMemo(() => {
    const visti: string[] = [];
    [...righe]
      .sort((a, b) => b.creato_al.localeCompare(a.creato_al))
      .forEach((r) => {
        if (r.codice_cliente && !visti.includes(r.codice_cliente)) visti.push(r.codice_cliente);
      });
    return visti;
  }, [righe]);
  const codiceNuovo = prossimoCodice(codiciUsati);

  const lotti = useMemo(() => {
    const m = new Map<string, { n: number; quando: string }>();
    for (const r of righe) {
      if (!r.lotto_import) continue;
      const x = m.get(r.lotto_import) ?? { n: 0, quando: r.creato_al };
      x.n += 1;
      m.set(r.lotto_import, x);
    }
    return Array.from(m.entries());
  }, [righe]);

  const soglia = sogliaCondensazione();
  const vecchie = righe.filter((r) => r.data_lavoro < soglia).length;

  function avvisa(s: string) {
    setAvviso(s);
    setTimeout(() => setAvviso(null), 3000);
  }

  async function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    const cent = Math.round(Number(importo.replace(",", ".")) * 100);
    if (!data || !Number.isFinite(cent) || cent < 0) {
      setErrore("Servono la data e un importo valido.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("ricavi_esterni").insert({
      professional_id: proId,
      data_lavoro: data,
      importo_cent: cent,
      service_id: servizio || null,
      comune_istat: comune?.istat ?? null,
      postal_code: /^\d{5}$/.test(cap) ? cap : null,
      codice_cliente: cliente.trim().slice(0, 20) || null,
      nota: nota.trim().slice(0, 200) || null,
      origine: "manuale",
    });
    setSalvando(false);
    if (error) {
      setErrore(error.code === "54000" ? error.message : "Non sono riuscito a salvare. Riprova.");
      return;
    }
    setImporto("");
    setNota("");
    setCliente("");
    avvisa("Aggiunto");
    carica();
  }

  async function elimina(id: number) {
    const { error } = await supabase.from("ricavi_esterni").delete().eq("id", id);
    if (error) setErrore("Non sono riuscito a cancellare la riga.");
    carica();
  }

  async function annullaImport(lotto: string, n: number) {
    if (!window.confirm(`Cancello le ${n} righe di questo import?`)) return;
    const { error } = await supabase.from("ricavi_esterni").delete().eq("lotto_import", lotto);
    if (error) setErrore("Non sono riuscito ad annullare l'import.");
    carica();
  }

  async function cancellaTutto() {
    if (!window.confirm("Cancello TUTTI i tuoi ricavi esterni, anche quelli già riassunti per mese? Non si torna indietro.")) return;
    const { error } = await supabase.rpc("cancella_tutti_i_ricavi_esterni");
    if (error) setErrore("Non sono riuscito a cancellare.");
    else avvisa("Cancellati");
    carica();
  }

  async function scaricaTutto() {
    setErrore(null);
    const { data: d, error } = await supabase
      .from("ricavi_esterni")
      .select("data_lavoro, importo_cent, service_id, comune_istat, postal_code, codice_cliente, nota, origine")
      .eq("professional_id", proId)
      .order("data_lavoro", { ascending: true });
    if (error) {
      setErrore("Il file non si è scaricato. Riprova.");
      return;
    }
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const foglio = XLSX.utils.json_to_sheet(
      ((d ?? []) as Riga[]).map((r) => ({
        Data: new Date(`${r.data_lavoro}T12:00:00`),
        "Importo (€)": r.importo_cent / 100,
        Servizio: r.service_id ? nomeServizio(r.service_id) : "",
        Comune: r.comune_istat ? nomiComuni[r.comune_istat] ?? r.comune_istat : "",
        CAP: r.postal_code ?? "",
        Cliente: r.codice_cliente ?? "",
        Nota: r.nota ?? "",
        Origine: r.origine === "csv" ? "importato" : "a mano",
      })),
      { cellDates: true, dateNF: "dd/mm/yyyy" }
    );
    XLSX.utils.book_append_sheet(wb, foglio, "Ricavi esterni");
    XLSX.writeFile(wb, "bob_ricavi_esterni.xlsx");
  }

  function scaricaModello() {
    const testo =
      "data;importo;servizio;comune;cap;cliente;nota\n03/06/2026;150,00;Idraulico;Milano;20121;C1;sostituzione rubinetto\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + testo], { type: "text/csv;charset=utf-8" }));
    a.download = "modello_ricavi_esterni.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Il comune dal CAP (se ne ha uno solo) o dal nome scritto (se ce n'e' uno
  // solo con quel nome). Mai indovinato: nel dubbio resta vuoto.
  async function risolviComuni(righeLette: RigaLetta[]): Promise<Map<string, string | null>> {
    const cache = new Map<string, string | null>();
    const chiavi = Array.from(new Set(righeLette.map((r) => `${r.cap ?? ""}|${r.comune ?? ""}`)));
    await Promise.all(
      chiavi.map(async (k) => {
        const [capR, nomeR] = k.split("|");
        let istat: string | null = null;
        try {
          if (capR) {
            const res = await fetch(`/api/geo/comuni?cap=${capR}`).then((x) => x.json());
            const lista = (res.comuni ?? []) as { istat: string; nome: string }[];
            if (lista.length === 1) istat = lista[0].istat;
            else if (nomeR) istat = lista.find((c) => normalizza(c.nome) === normalizza(nomeR))?.istat ?? null;
          } else if (nomeR) {
            const res = await fetch(`/api/geo/comuni?q=${encodeURIComponent(nomeR)}`).then((x) => x.json());
            const uguali = ((res.comuni ?? []) as { istat: string; nome: string }[]).filter(
              (c) => normalizza(c.nome) === normalizza(nomeR)
            );
            if (uguali.length === 1) istat = uguali[0].istat;
          }
        } catch {
          istat = null;
        }
        cache.set(k, istat);
      })
    );
    return cache;
  }

  async function leggiFile(f: File) {
    setErrore(null);
    setCsv(null);
    setPreparando(true);
    const testo = await f.text();
    const esito = leggiCsv(testo);
    if (esito.errore) {
      setErrore(esito.errore);
      setPreparando(false);
      return;
    }
    const comuni = await risolviComuni(esito.righe);
    const pronte: RigaPronta[] = esito.righe.map((r) => ({
      ...r,
      serviceId: trovaServizio(r.servizio, servizi),
      comuneIstat: comuni.get(`${r.cap ?? ""}|${r.comune ?? ""}`) ?? null,
    }));
    setCsv({ ...esito, pronte });
    setPreparando(false);
  }

  async function importa() {
    if (!csv) return;
    const scelte = csv.pronte.filter((r) => !(saltaDoppioni && r.doppione));
    if (!scelte.length) return;
    setImportando(true);
    setErrore(null);
    const lotto = crypto.randomUUID();
    // Un solo insert: il tetto e' controllato a fine istruzione, quindi
    // l'import passa tutto o niente.
    const { error } = await supabase.from("ricavi_esterni").insert(
      scelte.map((r) => ({
        professional_id: proId,
        data_lavoro: r.data,
        importo_cent: r.importoCent,
        service_id: r.serviceId,
        comune_istat: r.comuneIstat,
        postal_code: r.cap,
        codice_cliente: r.cliente,
        nota: r.nota,
        origine: "csv",
        lotto_import: lotto,
      }))
    );
    setImportando(false);
    if (error) {
      setErrore(error.code === "54000" ? error.message : "L'import non è riuscito: non ho salvato niente. Riprova.");
      return;
    }
    setCsv(null);
    if (fileRef.current) fileRef.current.value = "";
    avvisa(`${scelte.length} righe importate`);
    carica();
  }

  const totaleImporto = righe.reduce((s, r) => s + r.importo_cent, 0);

  return (
    <div className="container-bob space-y-6 py-8 sm:py-10" data-testid="ricavi-esterni">
      <SchedeNumeri attiva="esterni" />

      <section className="card p-5">
        <h2 className="text-lg font-bold text-bob-ink">Il lavoro fatto fuori da Bob</h2>
        <p className="mt-1.5 text-sm text-bob-ink/75">
          Aggiungi i lavori che hai fatto senza passare da Bob: nelle Analisi
          avanzate, con «tutto il mio lavoro», vedrai il quadro del tuo anno
          intero.
        </p>
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Non scrivere nomi, indirizzi o telefoni dei tuoi clienti: usa un
          codice (C1, C2…). Questi dati li vedi solo tu: lo staff di Bob non li
          legge e non entrano in nessuna analisi di Bob.
        </p>
      </section>

      {!puoScrivere && (
        <section className="card p-5" data-testid="esterni-free">
          <p className="text-sm text-bob-ink/80">
            Aggiungere ricavi esterni è incluso in Bob Plus e Bob Business.
            {totale > 0 &&
              " Quelli che hai già scritto restano tuoi: puoi vederli, scaricarli e cancellarli."}
          </p>
        </section>
      )}

      {errore && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errore}
        </p>
      )}
      {avviso && (
        <p className="text-sm font-medium text-bob-indigo" role="status">
          {avviso}
        </p>
      )}

      {puoScrivere && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={aggiungi} className="card space-y-3 p-5" data-testid="modulo-esterno">
            <h2 className="text-lg font-bold text-bob-ink">Aggiungi un lavoro</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="label-bob">
                Data
                <input type="date" value={data} max={oggiIso()} onChange={(e) => setData(e.target.value)} className="input-bob mt-1" required />
              </label>
              <label className="label-bob">
                Importo (€)
                <input inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} className="input-bob mt-1" placeholder="150" required data-testid="importo-esterno" />
              </label>
            </div>
            <label className="label-bob block">
              Servizio
              <select value={servizio} onChange={(e) => setServizio(e.target.value)} className="input-bob mt-1">
                <option value="">Non specificato</option>
                {servizi.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <SceltaComune comune={comune} cap={cap} onComune={setComune} onCap={setCap} />
            <div>
              <label className="label-bob" htmlFor="codice-cliente">
                Cliente (un codice, facoltativo)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="codice-cliente"
                  list="codici-usati"
                  value={cliente}
                  maxLength={20}
                  onChange={(e) => setCliente(e.target.value)}
                  className="input-bob min-w-0 flex-1"
                  placeholder={codiciUsati[0] ?? "C1"}
                  data-testid="codice-cliente"
                />
                <button type="button" onClick={() => setCliente(codiceNuovo)} className="btn-ghost shrink-0 text-sm">
                  Cliente nuovo → {codiceNuovo}
                </button>
              </div>
              <datalist id="codici-usati">
                {codiciUsati.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <label className="label-bob block">
              Nota
              <input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} className="input-bob mt-1" placeholder="Facoltativa, solo per te" />
            </label>
            <button type="submit" disabled={salvando} className="btn-primary w-full py-2.5">
              {salvando ? "Salvo…" : "Aggiungi"}
            </button>
          </form>

          <section className="card space-y-3 p-5" data-testid="import-csv">
            <h2 className="text-lg font-bold text-bob-ink">Importa da un file</h2>
            <p className="text-sm text-bob-ink/75">
              Un CSV da Excel, fino a 2.000 righe. Servono le colonne «data» e
              «importo»; servizio, comune, cap, cliente e nota sono facoltativi.
              Prima di salvare vedi cosa ho letto.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="btn-ghost cursor-pointer text-sm">
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Scegli il file
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && leggiFile(e.target.files[0])}
                />
              </label>
              <button type="button" onClick={scaricaModello} className="btn-ghost text-sm">
                <Download className="h-4 w-4" aria-hidden="true" />
                Modello
              </button>
            </div>
            {preparando && (
              <p className="flex items-center gap-2 text-sm text-bob-ink/70">
                <Loader2 className="h-4 w-4 animate-spin" /> Leggo il file…
              </p>
            )}
            {csv && (
              <div className="space-y-2 text-sm" data-testid="anteprima-csv">
                <p>
                  <strong>{csv.pronte.length}</strong> righe lette
                  {csv.scartate.length > 0 && (
                    <>
                      , <strong className="text-red-700">{csv.scartate.length}</strong> scartate
                    </>
                  )}
                  .
                </p>
                {csv.scartate.length > 0 && (
                  <ul className="max-h-28 overflow-y-auto rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    {csv.scartate.slice(0, 50).map((s) => (
                      <li key={s.riga}>
                        Riga {s.riga}: {s.motivo}
                      </li>
                    ))}
                  </ul>
                )}
                {csv.pronte.some((r) => r.doppione) && (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={saltaDoppioni} onChange={(e) => setSaltaDoppioni(e.target.checked)} />
                    Salta i {csv.pronte.filter((r) => r.doppione).length} doppioni (stessa data, importo e cliente)
                  </label>
                )}
                <div className="max-h-52 overflow-auto rounded-lg border border-black/[0.07]">
                  <table className="w-full text-xs">
                    <thead className="bg-black/[0.03] text-left">
                      <tr>
                        <th className="px-2 py-1">Data</th>
                        <th className="px-2 py-1 text-right">Importo</th>
                        <th className="px-2 py-1">Servizio</th>
                        <th className="px-2 py-1">Comune</th>
                        <th className="px-2 py-1">Cliente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csv.pronte.slice(0, 30).map((r) => (
                        <tr key={r.riga} className={r.doppione ? "text-bob-ink/45" : ""}>
                          <td className="px-2 py-1">{giorno(r.data)}</td>
                          <td className="px-2 py-1 text-right">{euro(r.importoCent)}</td>
                          <td className="px-2 py-1">{r.serviceId ? nomeServizio(r.serviceId) : r.servizio ? `«${r.servizio}» non riconosciuto` : "—"}</td>
                          <td className="px-2 py-1">{r.comuneIstat ? r.comune ?? r.cap : r.comune || r.cap ? `«${r.comune ?? r.cap}» non riconosciuto` : "—"}</td>
                          <td className="px-2 py-1">{r.cliente ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={importa} disabled={importando} className="btn-primary w-full py-2.5" data-testid="conferma-import">
                  {importando
                    ? "Importo…"
                    : `Importa ${csv.pronte.filter((r) => !(saltaDoppioni && r.doppione)).length} righe`}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {vecchie > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="avviso-condensazione">
          {vecchie === 1 ? "Una riga ha" : `${vecchie} righe hanno`} più di due anni: il 2 del
          mese prossimo {vecchie === 1 ? "verrà riassunta" : "verranno riassunte"} per mese,
          e nelle Analisi resteranno i totali. Se le vuoi intere, scaricale ora.
        </p>
      )}

      {(totale > 0 || caricando) && (
        <section className="card p-5" data-testid="elenco-esterni">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-bob-ink">
              I tuoi ricavi esterni{" "}
              <span className="text-sm font-normal text-bob-ink/60">
                {totale} righe{totale > LIMITE_ELENCO ? `, qui le ultime ${LIMITE_ELENCO}` : ""} · {euro(totaleImporto)}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={scaricaTutto} className="btn-ghost text-sm">
                <Download className="h-4 w-4" aria-hidden="true" />
                Scarica tutto (Excel)
              </button>
              <button type="button" onClick={cancellaTutto} className="btn-ghost text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Cancella tutto
              </button>
            </div>
          </div>

          {lotti.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {lotti.map(([lotto, x]) => (
                <li key={lotto} className="flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1">
                  Import del {new Date(x.quando).toLocaleDateString("it-IT")}: {x.n} righe
                  <button type="button" onClick={() => annullaImport(lotto, x.n)} className="font-semibold text-red-600 hover:underline">
                    annulla
                  </button>
                </li>
              ))}
            </ul>
          )}

          {caricando ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-bob-ink/70">
              <Loader2 className="h-4 w-4 animate-spin" /> Carico…
            </p>
          ) : (
            <div className="-mx-5 mt-4 overflow-x-auto px-5">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-bob-ink/60">
                    <th className="py-2 pr-3 font-semibold">Data</th>
                    <th className="py-2 pr-3 font-semibold">Servizio</th>
                    <th className="py-2 pr-3 font-semibold">Comune</th>
                    <th className="py-2 pr-3 font-semibold">Cliente</th>
                    <th className="py-2 pr-3 font-semibold">Nota</th>
                    <th className="py-2 pr-3 text-right font-semibold">Importo</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => (
                    <tr key={r.id} className="border-b border-black/[0.05]">
                      <td className="py-2 pr-3 tabular-nums">{giorno(r.data_lavoro)}</td>
                      <td className="py-2 pr-3">{nomeServizio(r.service_id)}</td>
                      <td className="py-2 pr-3">{r.comune_istat ? nomiComuni[r.comune_istat] ?? "—" : "—"}</td>
                      <td className="py-2 pr-3">{r.codice_cliente ?? "—"}</td>
                      <td className="max-w-[180px] truncate py-2 pr-3 text-bob-ink/70" title={r.nota ?? undefined}>
                        {r.nota ?? ""}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold tabular-nums">{euro(r.importo_cent)}</td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => elimina(r.id)} className="rounded p-1 text-bob-ink/50 hover:bg-red-50 hover:text-red-600" aria-label="Cancella questa riga">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
