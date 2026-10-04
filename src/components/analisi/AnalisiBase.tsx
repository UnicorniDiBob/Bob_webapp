"use client";

// L'Analisi base: il conto del professionista, mese per mese. Uguale per
// tutti i piani (Lucio, 04/10). Numeri grezzi, nessun rapporto e nessun
// confronto: quelli sono l'Analisi avanzata.
//
// EXCEL, TRE STRADE. «Scarica il mese» e «Scarica tutto» fanno un .xlsx vero
// (riepilogo + lavori; tutto = un foglio per i mesi e uno per tutti i lavori);
// «Copia per Excel» mette negli appunti la tabella del mese separata da
// tabulazioni, che si incolla gia' in colonne. Numeri e date all'italiana
// (virgola, gg/mm/aaaa): incollati in un Excel italiano restano numeri.
// La libreria xlsx si carica solo al clic: pesa, e la pagina non ne ha
// bisogno per mostrarsi.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SchedeNumeri } from "@/components/analisi/SchedeNumeri";

export interface LavoroConcluso {
  data: string;
  titolo: string | null;
  cliente: string;
  importo_cent: number | null;
  minuti: number;
  comune: string | null;
}

interface Conteggi {
  richieste: number;
  risposte: number;
  proposte: number;
  accettate: number;
  dirette: number;
  conclusi: number;
  disdetti: number;
  importo_cent: number;
  minuti: number;
}

export interface DatiAnalisiBase {
  mese: string; // aaaa-mm-01
  conteggi: Conteggi;
  totali: { conclusi: number; importo_cent: number };
  prenotati: { appuntamenti: number; minuti: number };
  lavori: LavoroConcluso[];
  mesi: string[]; // dal piu' recente
}

interface Storico {
  mesi: (Conteggi & { mese: string })[];
  lavori: LavoroConcluso[];
}

const VOCI: { chiave: keyof Conteggi; etichetta: string; spiega: string }[] = [
  { chiave: "richieste", etichetta: "Richieste ricevute", spiega: "Clienti che ti hanno scritto o chiesto un preventivo" },
  { chiave: "risposte", etichetta: "Risposte date", spiega: "Richieste a cui hai risposto almeno una volta" },
  { chiave: "proposte", etichetta: "Proposte inviate", spiega: "Appuntamenti con prezzo che hai proposto in chat" },
  { chiave: "accettate", etichetta: "Proposte accettate", spiega: "Diventate un appuntamento fissato" },
  { chiave: "dirette", etichetta: "Prenotazioni dirette", spiega: "Clienti che hanno prenotato da soli" },
  { chiave: "conclusi", etichetta: "Lavori conclusi", spiega: "Segnati come conclusi, nel giorno del lavoro" },
  { chiave: "disdetti", etichetta: "Disdetti", spiega: "Appuntamenti annullati" },
];

const euro = (cent: number) =>
  (cent / 100).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cent % 100 === 0 ? 0 : 2,
  });

const ore = (minuti: number) => {
  const h = Math.round((minuti / 60) * 10) / 10;
  return `${h.toLocaleString("it-IT")} h`;
};

const nomeMese = (iso: string) => {
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const giorno = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Rome",
  });

const meseParam = (iso: string) => iso.slice(0, 7);

// Per gli appunti: virgola decimale e niente separatore delle migliaia,
// altrimenti Excel italiano legge «1.250» come uno virgola venticinque.
const numeroIt = (n: number) =>
  n.toLocaleString("it-IT", { useGrouping: false, maximumFractionDigits: 2 });

function righeLavori(lavori: LavoroConcluso[]) {
  return lavori.map((l) => ({
    Data: new Date(l.data),
    Lavoro: l.titolo ?? "",
    Cliente: l.cliente,
    Comune: l.comune ?? "",
    "Durata (ore)": Math.round((l.minuti / 60) * 100) / 100,
    "Importo (€)": l.importo_cent == null ? null : l.importo_cent / 100,
  }));
}

function righeRiepilogo(c: Conteggi) {
  return [
    ...VOCI.map((v) => [v.etichetta, c[v.chiave]] as [string, number]),
    ["Importo dei lavori conclusi (€)", c.importo_cent / 100] as [string, number],
    ["Ore lavorate", Math.round((c.minuti / 60) * 100) / 100] as [string, number],
  ];
}

export function AnalisiBase({ dati }: { dati: DatiAnalisiBase }) {
  const router = useRouter();
  const [scaricando, setScaricando] = useState<"mese" | "tutto" | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const c = dati.conteggi;
  const i = dati.mesi.indexOf(dati.mese);
  const precedente = i >= 0 && i < dati.mesi.length - 1 ? dati.mesi[i + 1] : null;
  const successivo = i > 0 ? dati.mesi[i - 1] : null;
  const senzaImporto = dati.lavori.filter((l) => l.importo_cent == null).length;

  async function scaricaMese() {
    setScaricando("mese");
    setErrore(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const riepilogo = XLSX.utils.aoa_to_sheet([
        ["Mese", nomeMese(dati.mese)],
        [],
        ...righeRiepilogo(c),
      ]);
      riepilogo["!cols"] = [{ wch: 34 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, riepilogo, "Riepilogo");
      const lavori = dati.lavori.length
        ? XLSX.utils.json_to_sheet(righeLavori(dati.lavori), { cellDates: true, dateNF: "dd/mm/yyyy" })
        : XLSX.utils.aoa_to_sheet([["Nessun lavoro concluso in questo mese"]]);
      lavori["!cols"] = [{ wch: 12 }, { wch: 32 }, { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, lavori, "Lavori");
      XLSX.writeFile(wb, `bob_numeri_${meseParam(dati.mese)}.xlsx`);
    } catch {
      setErrore("Il file non si è scaricato. Riprova.");
    }
    setScaricando(null);
  }

  async function scaricaTutto() {
    setScaricando("tutto");
    setErrore(null);
    try {
      const { data, error } = await createClient().rpc("analisi_base_storico");
      if (error || !data) throw new Error(error?.message ?? "vuoto");
      const s = data as Storico;
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const mesi = XLSX.utils.json_to_sheet(
        s.mesi.map((m) => ({
          Mese: nomeMese(m.mese),
          ...Object.fromEntries(VOCI.map((v) => [v.etichetta, m[v.chiave]])),
          "Importo (€)": m.importo_cent / 100,
          "Ore lavorate": Math.round((m.minuti / 60) * 100) / 100,
        }))
      );
      XLSX.utils.book_append_sheet(wb, mesi, "Mesi");
      const lavori = s.lavori.length
        ? XLSX.utils.json_to_sheet(righeLavori(s.lavori), { cellDates: true, dateNF: "dd/mm/yyyy" })
        : XLSX.utils.aoa_to_sheet([["Nessun lavoro concluso"]]);
      XLSX.utils.book_append_sheet(wb, lavori, "Lavori");
      XLSX.writeFile(wb, "bob_numeri_tutto.xlsx");
    } catch {
      setErrore("Il file non si è scaricato. Riprova.");
    }
    setScaricando(null);
  }

  async function copiaPerExcel() {
    setErrore(null);
    const righe: string[] = [
      `${nomeMese(dati.mese)}\t`,
      ...righeRiepilogo(c).map(([k, v]) => `${k}\t${numeroIt(v)}`),
      "",
      ["Data", "Lavoro", "Cliente", "Comune", "Durata (ore)", "Importo (€)"].join("\t"),
      ...dati.lavori.map((l) =>
        [
          giorno(l.data),
          l.titolo ?? "",
          l.cliente,
          l.comune ?? "",
          numeroIt(Math.round((l.minuti / 60) * 100) / 100),
          l.importo_cent == null ? "" : numeroIt(l.importo_cent / 100),
        ]
          .map((x) => x.replace(/[\t\n]/g, " "))
          .join("\t")
      ),
    ];
    try {
      await navigator.clipboard.writeText(righe.join("\n"));
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch {
      setErrore("Il browser non ha permesso di copiare. Usa «Scarica il mese».");
    }
  }

  return (
    <div className="container-bob py-8 sm:py-10" data-testid="analisi-base">
      <SchedeNumeri attiva="base" />

      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-bob-ink/70">
          Il lavoro passato da Bob, mese per mese. Uguale su tutti i piani.
        </p>

        <nav
          aria-label="Scegli il mese"
          className="flex items-center gap-1"
          data-testid="selettore-mese"
        >
          <button
            type="button"
            disabled={!precedente}
            onClick={() => precedente && router.push(`/numeri?mese=${meseParam(precedente)}`)}
            className="rounded-lg p-2 text-bob-ink/70 hover:bg-black/5 disabled:opacity-30"
            aria-label="Mese precedente"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <select
            value={dati.mese}
            onChange={(e) => router.push(`/numeri?mese=${meseParam(e.target.value)}`)}
            className="input-bob w-auto py-2 pr-8 font-semibold"
            aria-label="Mese"
          >
            {dati.mesi.map((m) => (
              <option key={m} value={m}>
                {nomeMese(m)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!successivo}
            onClick={() => successivo && router.push(`/numeri?mese=${meseParam(successivo)}`)}
            className="rounded-lg p-2 text-bob-ink/70 hover:bg-black/5 disabled:opacity-30"
            aria-label="Mese successivo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </nav>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Casella
          etichetta="Importo dei lavori conclusi"
          valore={euro(c.importo_cent)}
          nota={`${c.conclusi} ${c.conclusi === 1 ? "lavoro" : "lavori"} nel mese`}
          accento
        />
        <Casella etichetta="Ore lavorate" valore={ore(c.minuti)} nota="Durata prevista dei lavori conclusi" />
        <Casella
          etichetta="Prenotato da oggi"
          valore={ore(dati.prenotati.minuti)}
          nota={`${dati.prenotati.appuntamenti} appuntamenti confermati`}
        />
        <Casella
          etichetta="Da sempre su Bob"
          valore={euro(dati.totali.importo_cent)}
          nota={`${dati.totali.conclusi} lavori conclusi`}
        />
      </div>

      <section className="card mt-6 p-5" aria-labelledby="titolo-mese">
        <h2 id="titolo-mese" className="text-lg font-bold text-bob-ink">
          {nomeMese(dati.mese)} in numeri
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="conteggi">
          {VOCI.map((v) => (
            <div key={v.chiave} className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
              <dt className="min-w-0">
                <span className="block text-sm font-medium text-bob-ink">{v.etichetta}</span>
                <span className="block text-xs text-bob-ink/60">{v.spiega}</span>
              </dt>
              <dd className="text-xl font-bold tabular-nums text-bob-ink">{c[v.chiave]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card mt-6 p-5" aria-labelledby="titolo-lavori">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titolo-lavori" className="text-lg font-bold text-bob-ink">
            Lavori conclusi
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiaPerExcel} className="btn-ghost text-sm" data-testid="copia-excel">
              <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
              {copiato ? "Copiato" : "Copia per Excel"}
            </button>
            <button type="button" onClick={scaricaMese} disabled={scaricando !== null} className="btn-ghost text-sm" data-testid="scarica-mese">
              {scaricando === "mese" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              Scarica il mese
            </button>
            <button type="button" onClick={scaricaTutto} disabled={scaricando !== null} className="btn-ghost text-sm" data-testid="scarica-tutto">
              {scaricando === "tutto" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              Scarica tutto
            </button>
          </div>
        </div>
        {errore && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {errore}
          </p>
        )}

        {senzaImporto > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="senza-importo">
            {senzaImporto === 1
              ? "Un lavoro non ha l'importo e qui conta zero."
              : `${senzaImporto} lavori non hanno l'importo e qui contano zero.`}{" "}
            Aggiungilo aprendo l&apos;appuntamento dal calendario.
          </p>
        )}

        {dati.lavori.length === 0 ? (
          <p className="mt-4 text-sm text-bob-ink/65">
            Nessun lavoro concluso in questo mese. Un lavoro entra qui quando lo
            segni «Completato» nel calendario.
          </p>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] text-sm" data-testid="tabella-lavori">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-bob-ink/60">
                  <th className="py-2 pr-3 font-semibold">Data</th>
                  <th className="py-2 pr-3 font-semibold">Lavoro</th>
                  <th className="py-2 pr-3 font-semibold">Cliente</th>
                  <th className="py-2 pr-3 font-semibold">Comune</th>
                  <th className="py-2 pr-3 text-right font-semibold">Durata</th>
                  <th className="py-2 text-right font-semibold">Importo</th>
                </tr>
              </thead>
              <tbody>
                {dati.lavori.map((l, k) => (
                  <tr key={k} className="border-b border-black/[0.05]">
                    <td className="py-2 pr-3 tabular-nums">{giorno(l.data)}</td>
                    <td className="py-2 pr-3">{l.titolo ?? "—"}</td>
                    <td className="py-2 pr-3">{l.cliente}</td>
                    <td className="py-2 pr-3">{l.comune ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{ore(l.minuti)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {l.importo_cent == null ? "—" : euro(l.importo_cent)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="py-2 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-bob-ink/60">
                    Totale
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums">{euro(c.importo_cent)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 text-xs leading-relaxed text-bob-ink/60">
        Gli importi sono quelli che scrivi negli appuntamenti, non incassi
        verificati. Un lavoro conta nel mese in cui l&apos;hai fatto, anche se
        lo segni concluso dopo. Questi numeri sono uguali su tutti i piani.
      </p>
    </div>
  );
}

function Casella({
  etichetta,
  valore,
  nota,
  accento,
}: {
  etichetta: string;
  valore: string;
  nota?: string;
  accento?: boolean;
}) {
  return (
    <div className={`card p-4 ${accento ? "bg-bob-indigo text-white" : ""}`}>
      <p className={`text-xs font-medium ${accento ? "text-white/70" : "text-bob-ink/70"}`}>
        {etichetta}
      </p>
      <p className={`mt-1 text-xl font-bold ${accento ? "text-white" : "text-bob-ink"}`}>
        {valore}
      </p>
      {nota && (
        <p className={`mt-0.5 text-xs ${accento ? "text-white/70" : "text-bob-ink/60"}`}>{nota}</p>
      )}
    </div>
  );
}
