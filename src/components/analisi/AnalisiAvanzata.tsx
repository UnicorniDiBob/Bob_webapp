"use client";

// Le Analisi avanzate: il ragionamento sopra il conto. Uguali per Plus e
// Business (Lucio, 04/10). Spec: docs/SPEC_analisi_professionista.md, §3.3,
// §3.4, §3.7.
//
// Si GUARDANO, non si leggono: ogni riquadro apre con un grafico o un numero
// grande, e sotto c'e' la frase che dice la cosa che conta. Ogni riquadro si
// copia come immagine o come numeri (GraficoCopiabile).
//
// LA REGOLA DEI 10 (§3.3): una percentuale si mostra solo con almeno dieci
// casi sotto. Prima si mostrano i conteggi («3 su 7»). Vale in tutta la
// pagina, e sta in src/lib/analisi.ts.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SchedeNumeri } from "@/components/analisi/SchedeNumeri";
import { GraficoCopiabile, type Cella } from "@/components/analisi/GraficoCopiabile";
import {
  nomeMese,
  nomePeriodo,
  quota,
  rapporto,
  scorciatoia,
  variazione,
  type Confronto,
  type MeseUrl,
  type Periodo,
  type Scorciatoia,
} from "@/lib/analisi";

interface Totali {
  richieste: number;
  risposte: number;
  risposte_1h: number;
  risposte_4h: number;
  risposte_24h: number;
  proposte: number;
  accettate: number;
  rifiutate: number;
  dirette: number;
  conclusi: number;
  disdetti: number;
  importo_cent: number;
  minuti: number;
}

interface Blocco {
  da: string;
  a: string;
  totali: Totali;
  per_mese: {
    mese: string;
    richieste: number;
    proposte: number;
    accettate: number;
    dirette: number;
    conclusi: number;
    importo_cent: number;
  }[];
  per_servizio: {
    servizio: string;
    richieste: number;
    proposte: number;
    accettate: number;
    dirette: number;
    conclusi: number;
    importo_cent: number;
  }[];
  per_comune: { comune: string; conclusi: number; importo_cent: number }[];
  prima_risposta: { fascia: number; richieste: number; arrivate: number }[];
  senza_risposta: { quante: number; ultime: { data: string; servizio: string }[] };
  clienti: { clienti: number; tornati: number; lavori_senza_cliente: number };
  saturazione: { mese: string; venduti: number; disponibili: number }[];
}

export interface DatiAvanzati {
  periodo: Blocco;
  contro?: Blocco;
  piano: string;
  dettaglio_dal: string;
}

const COLORE = { periodo: "#3730a3", contro: "#c7c4ef", arrivate: "#10b981", altre: "#e5e7eb" };

const FASCE: Record<number, string> = {
  1: "Entro 1 ora",
  2: "Da 1 a 4 ore",
  3: "Da 4 a 24 ore",
  4: "Oltre un giorno",
};

const SCORCIATOIE: { chiave: Scorciatoia; testo: string }[] = [
  { chiave: "mese", testo: "Questo mese" },
  { chiave: "mese-scorso", testo: "Mese scorso" },
  { chiave: "anno-finora", testo: "Anno finora" },
  { chiave: "ultimi-12", testo: "Ultimi 12 mesi" },
  { chiave: "anno-scorso", testo: "Anno scorso" },
];

const euro = (cent: number) =>
  (cent / 100).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const mese7 = (iso: string): MeseUrl => iso.slice(0, 7);

function Variazione({ adesso, prima, contro }: { adesso: number; prima?: number; contro: string | null }) {
  if (!contro || prima === undefined) return null;
  const v = variazione(adesso, prima);
  if (v === null) {
    return <span className="text-xs text-bob-ink/55">rispetto {contro}: prima era zero</span>;
  }
  const su = v > 0;
  return (
    <span className={`text-xs font-semibold ${v === 0 ? "text-bob-ink/60" : su ? "text-emerald-700" : "text-red-600"}`}>
      {su ? "+" : ""}
      {v}% rispetto {contro}
    </span>
  );
}

function Numero({
  etichetta,
  valore,
  adesso,
  prima,
  contro,
}: {
  etichetta: string;
  valore: string;
  adesso: number;
  prima?: number;
  contro: string | null;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-bob-ink/70">{etichetta}</p>
      <p className="mt-1 text-2xl font-bold text-bob-ink">{valore}</p>
      <Variazione adesso={adesso} prima={prima} contro={contro} />
    </div>
  );
}

export function AnalisiAvanzata({
  dati,
  periodo,
  confronto,
  oggi,
}: {
  dati: DatiAvanzati;
  periodo: Periodo;
  confronto: Confronto;
  oggi: MeseUrl;
}) {
  const router = useRouter();
  const [da, setDa] = useState(periodo.da);
  const [a, setA] = useState(periodo.a);

  const p = dati.periodo;
  const c = dati.contro ?? null;
  const t = p.totali;
  const ct = c?.totali;
  const nomeContro = c ? nomePeriodo({ da: mese7(c.da), a: mese7(c.a) }) : null;
  // Nelle caselle serve corto: «rispetto al 2025», non i due mesi per esteso.
  const controBreve = !c
    ? null
    : confronto === "anno"
      ? c.da.slice(0, 4) === c.a.slice(0, 4)
        ? `al ${c.da.slice(0, 4)}`
        : "all'anno prima"
      : "al periodo prima";
  const didascalia = `${nomePeriodo(periodo)}${nomeContro ? ` contro ${nomeContro}` : ""} · solo lavoro su Bob`;
  const file = `bob_${periodo.da}_${periodo.a}`;

  function vai(nuovo: Periodo, conf: Confronto = confronto) {
    router.push(`/numeri/avanzate?da=${nuovo.da}&a=${nuovo.a}&contro=${conf}`);
  }

  const medio = t.conclusi > 0 ? t.importo_cent / t.conclusi : 0;
  const medioContro = ct && ct.conclusi > 0 ? ct.importo_cent / ct.conclusi : ct ? 0 : undefined;

  // --- Andamento ---
  const andamento = p.per_mese.map((m, i) => ({
    etichetta: nomeMese(mese7(m.mese), true),
    [nomePeriodo(periodo)]: m.importo_cent / 100,
    ...(c && nomeContro ? { [nomeContro]: (c.per_mese[i]?.importo_cent ?? 0) / 100 } : {}),
  }));
  const righeAndamento: Cella[][] = [
    ["Mese", "Importo (€)", "Lavori conclusi", "Richieste", ...(c ? ["Mese di confronto", "Importo (€)", "Lavori conclusi", "Richieste"] : [])],
    ...p.per_mese.map((m, i) => {
      const x = c?.per_mese[i];
      return [
        nomeMese(mese7(m.mese)),
        m.importo_cent / 100,
        m.conclusi,
        m.richieste,
        ...(c ? [x ? nomeMese(mese7(x.mese)) : "", x ? x.importo_cent / 100 : null, x?.conclusi ?? null, x?.richieste ?? null] : []),
      ];
    }),
  ];

  // --- Imbuto ---
  const passi = [
    { passo: "Richieste ricevute", n: t.richieste, prima: ct?.richieste },
    { passo: "Risposte date", n: t.risposte, prima: ct?.risposte },
    { passo: "Proposte inviate", n: t.proposte, prima: ct?.proposte },
    { passo: "Proposte accettate", n: t.accettate, prima: ct?.accettate },
  ];
  const righeImbuto: Cella[][] = [
    ["Passo", "Quante", "Sul passo prima", ...(c ? ["Confronto"] : [])],
    ...passi.map((x, i) => [
      x.passo,
      x.n,
      i === 0 ? "" : quota(x.n, passi[i - 1].n),
      ...(c ? [x.prima ?? null] : []),
    ]),
  ];

  // --- Prima risposta contro arrivo a un appuntamento ---
  const fasce = [1, 2, 3, 4].map((f) => {
    const b = p.prima_risposta.find((x) => x.fascia === f);
    const n = b?.richieste ?? 0;
    const arr = b?.arrivate ?? 0;
    return { fascia: FASCE[f], Arrivate: arr, "Non arrivate": n - arr, n, arr };
  });
  const totRisposte = fasce.reduce((s, f) => s + f.n, 0);
  const migliore = fasce
    .filter((f) => rapporto(f.arr, f.n) !== null)
    .sort((x, y) => (rapporto(y.arr, y.n) ?? 0) - (rapporto(x.arr, x.n) ?? 0))[0];
  const righeRisposta: Cella[][] = [
    ["Prima risposta", "Richieste", "Arrivate a un appuntamento", "Quota"],
    ...fasce.map((f) => [f.fascia, f.n, f.arr, quota(f.arr, f.n)]),
  ];

  // --- Servizi ---
  const righeServizi: Cella[][] = [
    ["Servizio", "Richieste", "Proposte", "Accettate", "Prenotazioni dirette", "Lavori conclusi", "Importo (€)"],
    ...p.per_servizio.map((s) => [s.servizio, s.richieste, s.proposte, s.accettate, s.dirette, s.conclusi, s.importo_cent / 100]),
  ];

  // --- Zone ---
  const zone = p.per_comune.slice(0, 10).map((z) => ({ comune: z.comune, Importo: z.importo_cent / 100 }));
  const righeZone: Cella[][] = [
    ["Comune", "Lavori conclusi", "Importo (€)", "Valore medio (€)"],
    ...p.per_comune.map((z) => [z.comune, z.conclusi, z.importo_cent / 100, z.conclusi ? Math.round(z.importo_cent / z.conclusi) / 100 : null]),
  ];

  // --- Saturazione ---
  const senzaOrari = p.saturazione.every((s) => s.disponibili === 0);
  const saturazione = p.saturazione.map((s) => ({
    etichetta: nomeMese(mese7(s.mese), true),
    "Agenda venduta (%)": s.disponibili > 0 ? Math.round((s.venduti / s.disponibili) * 100) : 0,
  }));
  const righeSaturazione: Cella[][] = [
    ["Mese", "Ore vendute", "Ore disponibili", "Agenda venduta (%)"],
    ...p.saturazione.map((s) => [
      nomeMese(mese7(s.mese)),
      Math.round((s.venduti / 60) * 10) / 10,
      Math.round((s.disponibili / 60) * 10) / 10,
      s.disponibili > 0 ? Math.round((s.venduti / s.disponibili) * 100) : null,
    ]),
  ];

  const dettaglioMancante = periodo.da < mese7(dati.dettaglio_dal);

  return (
    <div className="container-bob space-y-6 py-8 sm:py-10" data-testid="analisi-avanzata">
      <SchedeNumeri attiva="avanzata" />

      {/* IL PERIODO. Scorciatoie per i casi di tutti i giorni, due mesi per
          tutto il resto, e il confronto: per difetto lo stesso periodo un
          anno prima, perche' agosto si confronta con agosto. */}
      <section className="card space-y-3 p-4" aria-label="Periodo" data-testid="scelta-periodo">
        <div className="flex flex-wrap gap-2">
          {SCORCIATOIE.map((s) => {
            const q = scorciatoia(s.chiave, oggi);
            const attiva = q.da === periodo.da && q.a === periodo.a;
            return (
              <button
                key={s.chiave}
                type="button"
                onClick={() => vai(q)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  attiva ? "bg-bob-indigo text-white" : "border border-black/10 bg-white text-bob-ink/70 hover:text-bob-indigo"
                }`}
              >
                {s.testo}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-bob-ink/70">
            Da
            <input
              type="month"
              value={da}
              max={oggi}
              onChange={(e) => setDa(e.target.value)}
              className="input-bob mt-1 block py-2"
            />
          </label>
          <label className="text-xs font-medium text-bob-ink/70">
            A
            <input
              type="month"
              value={a}
              max={oggi}
              onChange={(e) => setA(e.target.value)}
              className="input-bob mt-1 block py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => da && a && vai({ da, a })}
            className="btn-primary px-4 py-2 text-sm"
          >
            Mostra
          </button>
          <label className="text-xs font-medium text-bob-ink/70">
            Confronta con
            <select
              value={confronto}
              onChange={(e) => vai(periodo, e.target.value as Confronto)}
              className="input-bob mt-1 block py-2"
            >
              <option value="anno">Stesso periodo, anno prima</option>
              <option value="prec">Periodo subito prima</option>
              <option value="no">Nessun confronto</option>
            </select>
          </label>
        </div>
        <p className="text-sm font-semibold text-bob-ink">
          {nomePeriodo(periodo)}
          {nomeContro && <span className="font-normal text-bob-ink/65"> contro {nomeContro}</span>}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero etichetta="Importo dei lavori conclusi" valore={euro(t.importo_cent)} adesso={t.importo_cent} prima={ct?.importo_cent} contro={controBreve} />
        <Numero etichetta="Lavori conclusi" valore={String(t.conclusi)} adesso={t.conclusi} prima={ct?.conclusi} contro={controBreve} />
        <Numero etichetta="Valore medio di un lavoro" valore={t.conclusi ? euro(medio) : "—"} adesso={medio} prima={medioContro} contro={controBreve} />
        <Numero etichetta="Richieste ricevute" valore={String(t.richieste)} adesso={t.richieste} prima={ct?.richieste} contro={controBreve} />
      </div>

      <GraficoCopiabile
        titolo="Andamento, mese per mese"
        sottotitolo="L'importo dei lavori conclusi in ogni mese."
        didascalia={didascalia}
        righe={righeAndamento}
        nomeFile={`${file}_andamento`}
        testId="riquadro-andamento"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={andamento}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
              <XAxis dataKey="etichetta" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${v} €`} />
              <Tooltip formatter={(v) => euro(Number(v) * 100)} cursor={{ fill: "rgba(55,48,163,0.05)" }} />
              {c && <Legend iconType="circle" />}
              <Bar dataKey={nomePeriodo(periodo)} fill={COLORE.periodo} radius={[4, 4, 0, 0]} maxBarSize={36} />
              {c && nomeContro && <Bar dataKey={nomeContro} fill={COLORE.contro} radius={[4, 4, 0, 0]} maxBarSize={36} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GraficoCopiabile>

      <GraficoCopiabile
        titolo="Da dove arriva il tuo lavoro"
        sottotitolo={
          <>
            Dalle richieste alle proposte accettate. In più,{" "}
            <strong>{t.dirette}</strong> prenotazioni dirette, che non passano
            dalle proposte, e <strong>{t.conclusi}</strong> lavori conclusi in
            tutto.
          </>
        }
        didascalia={didascalia}
        righe={righeImbuto}
        nomeFile={`${file}_imbuto`}
        testId="riquadro-imbuto"
      >
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={passi.map((x) => ({ passo: x.passo, Quante: x.n }))} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="passo" width={130} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
              <Bar dataKey="Quante" fill={COLORE.periodo} radius={[0, 4, 4, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {passi.slice(1).map((x, i) => (
            <li key={x.passo} className="rounded-xl bg-bob-indigo-50 px-3 py-2">
              <span className="block text-xs text-bob-ink/65">
                {x.passo} su {passi[i].passo.toLowerCase()}
              </span>
              <span className="text-lg font-bold text-bob-ink">{quota(x.n, passi[i].n)}</span>
            </li>
          ))}
        </ul>
      </GraficoCopiabile>

      <GraficoCopiabile
        titolo="Quanto conta rispondere presto"
        sottotitolo={
          totRisposte === 0
            ? "Nessuna risposta nel periodo."
            : migliore
              ? `Quando rispondi ${migliore.fascia.toLowerCase()}, ${quota(migliore.arr, migliore.n)} delle richieste arriva a un appuntamento.`
              : "Per ogni fascia di attesa, quante richieste sono arrivate a un appuntamento. Le percentuali compaiono da dieci richieste in su."
        }
        didascalia={didascalia}
        righe={righeRisposta}
        nomeFile={`${file}_prima_risposta`}
        testId="riquadro-prima-risposta"
      >
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fasce}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
              <XAxis dataKey="fascia" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={32} />
              <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
              <Legend iconType="circle" />
              <Bar dataKey="Arrivate" stackId="r" fill={COLORE.arrivate} maxBarSize={48} />
              <Bar dataKey="Non arrivate" stackId="r" fill={COLORE.altre} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GraficoCopiabile>

      <GraficoCopiabile
        titolo="Richieste rimaste senza risposta"
        sottotitolo="Ricevute da più di 48 ore, senza una tua risposta e senza una prenotazione."
        didascalia={didascalia}
        righe={[
          ["Data", "Servizio"],
          ...p.senza_risposta.ultime.map((r) => [
            new Date(r.data).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" }),
            r.servizio,
          ]),
        ]}
        nomeFile={`${file}_senza_risposta`}
        immagine={false}
        testId="riquadro-senza-risposta"
      >
        <p className="text-3xl font-bold text-bob-ink">{p.senza_risposta.quante}</p>
        {c && (
          <p className="text-xs text-bob-ink/60">
            {c.senza_risposta.quante} in {nomeContro}
          </p>
        )}
        {p.senza_risposta.ultime.length > 0 && (
          <ul className="mt-3 divide-y divide-black/[0.05] text-sm">
            {p.senza_risposta.ultime.map((r, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span>{r.servizio}</span>
                <span className="tabular-nums text-bob-ink/65">
                  {new Date(r.data).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GraficoCopiabile>

      <GraficoCopiabile
        titolo="Quali servizi portano lavoro"
        sottotitolo="Un servizio con proposte e nessun lavoro concluso è un servizio che ti fa lavorare a vuoto."
        didascalia={didascalia}
        righe={righeServizi}
        nomeFile={`${file}_servizi`}
        immagine={false}
        testId="riquadro-servizi"
      >
        {p.per_servizio.length === 0 ? (
          <p className="text-sm text-bob-ink/65">Nessun servizio con attività nel periodo.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-bob-ink/60">
                  <th className="py-2 pr-3 font-semibold">Servizio</th>
                  <th className="py-2 pr-3 text-right font-semibold">Proposte</th>
                  <th className="py-2 pr-3 text-right font-semibold">Accettate</th>
                  <th className="py-2 pr-3 text-right font-semibold">Dirette</th>
                  <th className="py-2 pr-3 text-right font-semibold">Conclusi</th>
                  <th className="py-2 text-right font-semibold">Importo</th>
                </tr>
              </thead>
              <tbody>
                {p.per_servizio.map((s) => (
                  <tr key={s.servizio} className="border-b border-black/[0.05]">
                    <td className="py-2 pr-3">
                      {s.servizio}
                      {s.proposte > 0 && s.conclusi === 0 && (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                          solo proposte
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.proposte}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.accettate}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.dirette}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.conclusi}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{euro(s.importo_cent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GraficoCopiabile>

      <GraficoCopiabile
        titolo="Dove lavori"
        sottotitolo="L'importo dei lavori conclusi per comune, e quanto vale in media un lavoro lì."
        didascalia={didascalia}
        righe={righeZone}
        nomeFile={`${file}_zone`}
        testId="riquadro-zone"
      >
        {zone.length === 0 ? (
          <p className="text-sm text-bob-ink/65">Nessun lavoro concluso nel periodo.</p>
        ) : (
          <>
            <div style={{ height: Math.max(120, zone.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zone} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" horizontal={false} />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v} €`} />
                  <YAxis type="category" dataKey="comune" width={130} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => euro(Number(v) * 100)} cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                  <Bar dataKey="Importo" fill={COLORE.periodo} radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {p.per_comune.slice(0, 10).map((z) => (
                <li key={z.comune} className="rounded-full bg-black/[0.04] px-2.5 py-1">
                  {z.comune}: {euro(z.conclusi ? z.importo_cent / z.conclusi : 0)} a lavoro
                </li>
              ))}
            </ul>
            {p.per_comune.some((z) => z.comune === "Comune non indicato") && (
              <p className="mt-2 text-xs text-bob-ink/60">
                «Comune non indicato» sono i lavori senza comune. Da ora lo scegli
                quando crei l&apos;appuntamento.
              </p>
            )}
          </>
        )}
      </GraficoCopiabile>

      <div className="grid gap-6 lg:grid-cols-2">
        <GraficoCopiabile
          titolo="Clienti che tornano"
          didascalia={didascalia}
          righe={[
            ["Clienti con un lavoro concluso", p.clienti.clienti],
            ["Di questi, già clienti prima", p.clienti.tornati],
            ["Lavori senza cliente registrato", p.clienti.lavori_senza_cliente],
          ]}
          nomeFile={`${file}_clienti`}
          immagine={false}
          testId="riquadro-clienti"
        >
          <p className="text-3xl font-bold text-bob-ink">
            {p.clienti.clienti === 0 ? "—" : quota(p.clienti.tornati, p.clienti.clienti)}
          </p>
          <p className="mt-1 text-sm text-bob-ink/70">
            {p.clienti.tornati} clienti su {p.clienti.clienti} ti avevano già
            scelto prima.
          </p>
          {p.clienti.lavori_senza_cliente > 0 && (
            <p className="mt-2 text-xs text-bob-ink/60">
              Contati solo i clienti che ti hanno trovato su Bob:{" "}
              {p.clienti.lavori_senza_cliente} lavori del periodo li hai scritti tu
              e non hanno un cliente registrato.
            </p>
          )}
        </GraficoCopiabile>

        <GraficoCopiabile
          titolo="Quanto è piena la tua agenda"
          sottotitolo="Ore di lavoro fissate o concluse, sulle ore che hai detto di avere libere."
          didascalia={didascalia}
          righe={righeSaturazione}
          nomeFile={`${file}_agenda`}
          testId="riquadro-agenda"
        >
          {senzaOrari ? (
            <p className="text-sm text-bob-ink/65">
              Non hai ancora indicato i tuoi orari: impostali in{" "}
              <Link href="/impostazioni/orari" className="font-medium text-bob-indigo hover:underline">
                Orari
              </Link>{" "}
              e qui vedrai quanto è piena la tua settimana.
            </p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={saturazione}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
                  <XAxis dataKey="etichetta" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(v) => `${v}%`} cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                  <Bar dataKey="Agenda venduta (%)" fill={COLORE.periodo} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GraficoCopiabile>
      </div>

      <p className="text-xs leading-relaxed text-bob-ink/60">
        Solo il lavoro passato da Bob. Gli importi sono quelli che scrivi negli
        appuntamenti. Le percentuali compaiono da dieci casi in su: prima vedi
        i conteggi. Gli orari disponibili dei mesi passati sono quelli di oggi.
        {dettaglioMancante &&
          " Per i mesi più vecchi di due anni la prima risposta e le richieste senza risposta non hanno più il dettaglio."}
      </p>
    </div>
  );
}

export function AnalisiAvanzataChiusa() {
  return (
    <div className="container-bob space-y-6 py-8 sm:py-10" data-testid="analisi-avanzata-chiusa">
      <SchedeNumeri attiva="avanzata" />
      <section className="card max-w-2xl p-6">
        <h2 className="text-lg font-bold text-bob-ink">
          Le Analisi avanzate sono in Bob Plus e Bob Business
        </h2>
        <p className="mt-2 text-sm text-bob-ink/75">
          Il conto del mese resta tuo su ogni piano. Le Analisi avanzate ci
          ragionano sopra:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-bob-ink/80">
          <li>quante richieste diventano un appuntamento, passo per passo;</li>
          <li>quanto conta rispondere presto;</li>
          <li>quali servizi portano lavoro e quali solo proposte;</li>
          <li>dove lavori e quanto vale un lavoro in ogni comune;</li>
          <li>quanto è piena la tua agenda e quanti clienti tornano;</li>
          <li>il confronto con lo stesso periodo dell&apos;anno prima;</li>
          <li>ogni grafico si copia come immagine o come numeri per Excel.</li>
        </ul>
        <Link href="/impostazioni/piano" className="btn-primary mt-5 inline-flex px-5 py-2.5">
          Vedi i piani
        </Link>
      </section>
    </div>
  );
}
