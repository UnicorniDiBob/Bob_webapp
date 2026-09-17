"use client";

// Il disegno della pagina Copertura: una mappa, una tabella, e due bottoni per
// portarsele via.
//
// PERCHÉ LA MAPPA È SVG A MANO E NON MAPLIBRE
// Qui non si trascina e non si zooma: è una figura, non uno strumento. Un SVG
// disegnato da noi si esporta com'è — il file che si scarica È quello che si
// vede — mentre una mappa a tela andrebbe rifotografata. E vale la stessa
// ragione di sempre: nessuna tile, quindi nessuna richiesta a un fornitore
// terzo da una pagina che mostra dove stanno i nostri professionisti.
//
// LA SCALA DI COLORE
// Una tinta sola, dal chiaro allo scuro (indaco). Non un arcobaleno: qui si
// legge «quanti», che è una quantità, e una quantità si legge dall'intensità.
// Lo zero ha un grigio suo, perché «nessuno» non è «pochi»: è la domanda a cui
// serve rispondere.
//
// I BUCHI HANNO UN SEGNO, NON SOLO UN COLORE
// Un comune da cui arrivano richieste e dove non copre nessuno porta un
// pallino, oltre al colore. Il colore da solo lo perderebbe chi non distingue
// bene le tinte, e chi stampa in bianco e nero.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { percorsoProvincia, leggiConfini, type FormaComune } from "@/lib/confini";

export interface ComuneRiga {
  istat: string;
  nome: string;
  lat: number | null;
  lng: number | null;
  /** Professionisti che hanno la base qui (085). */
  proBase: number;
  /** Professionisti che coprono questo comune per nome: comune, città o quartieri. */
  proPrecisi: number;
  /** Professionisti che lo coprono per ambito largo: provincia, regione, Italia. */
  proAmpi: number;
  richieste: number;
}

interface Totali {
  proAttivi: number;
  proConArea: number;
  proConBase: number;
  richiesteTotali: number;
  richiesteConComune: number;
}

interface Props {
  provincia: string;
  sigla: string | null;
  province: string[];
  righe: ComuneRiga[];
  totali: Totali;
}

type Metrica = "proPrecisi" | "proBase" | "richieste" | "proAmpi";

const METRICHE: { chiave: Metrica; nome: string; spiega: string }[] = [
  {
    chiave: "proPrecisi",
    nome: "Copertura dichiarata",
    spiega: "professionisti che hanno dichiarato questo comune, o i quartieri della sua città",
  },
  {
    chiave: "proBase",
    nome: "Base del professionista",
    spiega: "professionisti che hanno qui l'indirizzo dichiarato all'iscrizione",
  },
  {
    chiave: "richieste",
    nome: "Richieste ricevute",
    spiega: "richieste dei clienti attribuite a questo comune, dal CAP o dalla città",
  },
  {
    chiave: "proAmpi",
    nome: "Copertura larga",
    spiega: "professionisti che lo prendono dentro provincia, regione o Italia intera",
  },
];

// Una tinta sola, dal chiaro allo scuro. Lo zero sta fuori dalla scala.
const ZERO = "#f1f0ec";
const SCALA = ["#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5", "#3730a3"];
const BUCO = "#b91c1c";

/** In quale gradino cade un valore. Soglie fisse, non quantili. */
function gradino(valore: number, massimo: number): number {
  if (valore <= 0) return -1;
  if (massimo <= SCALA.length) return Math.min(valore - 1, SCALA.length - 1);
  const passo = massimo / SCALA.length;
  return Math.min(Math.floor((valore - 1) / passo), SCALA.length - 1);
}

function colore(valore: number, massimo: number): string {
  const g = gradino(valore, massimo);
  return g < 0 ? ZERO : SCALA[g];
}

export function CoperturaDashboard({ provincia, sigla, province, righe, totali }: Props) {
  const [metrica, setMetrica] = useState<Metrica>("proPrecisi");
  const [cerca, setCerca] = useState("");
  const [soloBuchi, setSoloBuchi] = useState(false);
  const [ordine, setOrdine] = useState<{ campo: keyof ComuneRiga; giu: boolean }>({
    campo: "proPrecisi",
    giu: true,
  });
  const [forme, setForme] = useState<FormaComune[]>([]);
  const [sopra, setSopra] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const perIstat = useMemo(() => new Map(righe.map((r) => [r.istat, r])), [righe]);
  const massimo = useMemo(
    () => Math.max(1, ...righe.map((r) => r[metrica] as number)),
    [righe, metrica]
  );
  const buchi = useMemo(
    () => righe.filter((r) => r.richieste > 0 && r.proPrecisi === 0),
    [righe]
  );

  // I confini della provincia guardata: lo stesso file della mappa del
  // professionista, quindi niente da generare e niente da tenere allineato.
  useEffect(() => {
    if (!sigla) {
      setForme([]);
      return;
    }
    let vivo = true;
    fetch(percorsoProvincia(sigla))
      .then((r) => (r.ok ? r.json() : null))
      .then((dati) => {
        if (!vivo || !dati) return;
        setForme(leggiConfini(dati));
      })
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, [sigla]);

  // La proiezione: equirettangolare con la correzione del coseno, che a
  // larghezza di provincia non si distingue da Mercatore e si scrive in tre
  // righe. Il riquadro lo danno le forme, non i centri: un comune sul bordo
  // resterebbe tagliato.
  const LARGHEZZA = 720;
  const ALTEZZA = 520;
  const proiezione = useMemo(() => {
    if (forme.length === 0) return null;
    let ovest = Infinity;
    let sud = Infinity;
    let est = -Infinity;
    let nord = -Infinity;
    for (const f of forme) {
      ovest = Math.min(ovest, f.riquadro[0]);
      sud = Math.min(sud, f.riquadro[1]);
      est = Math.max(est, f.riquadro[2]);
      nord = Math.max(nord, f.riquadro[3]);
    }
    const k = Math.cos((((sud + nord) / 2) * Math.PI) / 180);
    const larghezzaGradi = (est - ovest) * k;
    const altezzaGradi = nord - sud;
    const scala = Math.min(
      (LARGHEZZA - 24) / larghezzaGradi,
      (ALTEZZA - 24) / altezzaGradi
    );
    const scartoX = (LARGHEZZA - larghezzaGradi * scala) / 2;
    const scartoY = (ALTEZZA - altezzaGradi * scala) / 2;
    return (lng: number, lat: number): [number, number] => [
      scartoX + (lng - ovest) * k * scala,
      scartoY + (nord - lat) * scala,
    ];
  }, [forme]);

  const tracciati = useMemo(() => {
    if (!proiezione) return [];
    return forme.map((f) => ({
      istat: f.istat,
      nome: f.nome,
      d: f.anelli
        .map((anello) => {
          const punti = anello.map(([lng, lat]) => {
            const [x, y] = proiezione(lng, lat);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          });
          return punti.length ? `M${punti.join("L")}Z` : "";
        })
        .join(""),
      centro: (() => {
        const r = perIstat.get(f.istat);
        if (!r || r.lat === null || r.lng === null) return null;
        return proiezione(r.lng, r.lat);
      })(),
    }));
  }, [forme, proiezione, perIstat]);

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    let elenco = righe;
    if (q) elenco = elenco.filter((r) => r.nome.toLowerCase().includes(q));
    if (soloBuchi) elenco = elenco.filter((r) => r.richieste > 0 && r.proPrecisi === 0);
    const { campo, giu } = ordine;
    return [...elenco].sort((a, b) => {
      const x = a[campo];
      const y = b[campo];
      const c =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "it");
      return giu ? -c : c;
    });
  }, [righe, cerca, soloBuchi, ordine]);

  const ordinaPer = useCallback((campo: keyof ComuneRiga) => {
    setOrdine((p) => (p.campo === campo ? { campo, giu: !p.giu } : { campo, giu: true }));
  }, []);

  const scaricaCsv = useCallback(() => {
    const intestazione = [
      "istat",
      "comune",
      "provincia",
      "pro_copertura_dichiarata",
      "pro_copertura_larga",
      "pro_con_base_qui",
      "richieste",
      "buco",
    ];
    const virgolette = (v: string | number) =>
      typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`;
    const corpo = visibili.map((r) =>
      [
        r.istat,
        r.nome,
        provincia,
        r.proPrecisi,
        r.proAmpi,
        r.proBase,
        r.richieste,
        r.richieste > 0 && r.proPrecisi === 0 ? "si" : "",
      ]
        .map(virgolette)
        .join(",")
    );
    scarica(
      [intestazione.join(","), ...corpo].join("\n"),
      "text/csv;charset=utf-8",
      `copertura-${provincia.toLowerCase().replace(/\s+/g, "-")}.csv`
    );
  }, [visibili, provincia]);

  const scaricaSvg = useCallback(() => {
    const nodo = svgRef.current;
    if (!nodo) return;
    // Si esporta quello che si vede, con la dichiarazione XML e la fonte
    // dentro: il file va in una slide e deve restare attribuibile (CC BY 4.0).
    const copia = nodo.cloneNode(true) as SVGSVGElement;
    copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    scarica(
      `<?xml version="1.0" encoding="UTF-8"?>\n${copia.outerHTML}`,
      "image/svg+xml;charset=utf-8",
      `mappa-copertura-${provincia.toLowerCase().replace(/\s+/g, "-")}.svg`
    );
  }, [provincia]);

  const rigaSopra = sopra ? perIstat.get(sopra) : null;
  const etichettaMetrica = METRICHE.find((m) => m.chiave === metrica)!;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Copertura</h1>
        <p className="max-w-3xl text-sm text-ink/70">
          Dove stanno i professionisti, comune per comune: dove hanno la base, dove hanno
          dichiarato di lavorare, e da dove arrivano le richieste. La colonna che conta è
          l&apos;ultima: i comuni con richieste e nessuno che le copre.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tessera nome="Professionisti attivi" valore={totali.proAttivi} />
        <Tessera
          nome="Con un'area disegnata"
          valore={totali.proConArea}
          su={totali.proAttivi}
        />
        <Tessera
          nome="Con la base dichiarata"
          valore={totali.proConBase}
          su={totali.proAttivi}
        />
        <Tessera nome="Richieste" valore={totali.richiesteTotali} />
        <Tessera
          nome="Richieste con comune"
          valore={totali.richiesteConComune}
          su={totali.richiesteTotali}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Provincia</span>
            <form method="get">
              <select
                name="provincia"
                defaultValue={provincia}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="rounded-lg border border-ink/20 px-3 py-2 text-sm"
              >
                {province.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </form>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Cosa colora la mappa</span>
            <select
              value={metrica}
              onChange={(e) => setMetrica(e.target.value as Metrica)}
              className="rounded-lg border border-ink/20 px-3 py-2 text-sm"
            >
              {METRICHE.map((m) => (
                <option key={m.chiave} value={m.chiave}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={scaricaSvg}
              className="rounded-lg border border-ink/20 px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5"
            >
              Scarica la mappa (SVG)
            </button>
            <button
              type="button"
              onClick={scaricaCsv}
              className="rounded-lg border border-ink/20 px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5"
            >
              Scarica la tabella (CSV)
            </button>
          </div>
        </div>

        <p className="text-sm text-ink/60">{etichettaMetrica.spiega}.</p>

        {forme.length === 0 ? (
          <p className="rounded-xl bg-ink/5 p-6 text-sm text-ink/70">
            {sigla
              ? `Non ho i confini della provincia di ${provincia}.`
              : `Non ho l'elenco dei comuni della provincia di ${provincia}.`}{" "}
            La tabella qui sotto funziona lo stesso.
          </p>
        ) : (
          <div className="relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
              className="h-auto w-full rounded-xl bg-[#faf9f7]"
              role="img"
              aria-label={`Mappa della provincia di ${provincia}: ${etichettaMetrica.nome.toLowerCase()} per comune. I numeri esatti sono nella tabella qui sotto.`}
            >
              <title>{`${etichettaMetrica.nome} — provincia di ${provincia}`}</title>
              {tracciati.map((t) => {
                const r = perIstat.get(t.istat);
                const valore = r ? (r[metrica] as number) : 0;
                const acceso = sopra === t.istat;
                return (
                  <path
                    key={t.istat}
                    d={t.d}
                    fill={colore(valore, massimo)}
                    stroke={acceso ? "#1e1b4b" : "rgba(30,27,75,0.22)"}
                    strokeWidth={acceso ? 2 : 0.7}
                    onMouseEnter={() => setSopra(t.istat)}
                    onMouseLeave={() => setSopra((p) => (p === t.istat ? null : p))}
                  >
                    <title>{`${t.nome}: ${valore}`}</title>
                  </path>
                );
              })}
              {/* I buchi portano un segno, non solo il colore. */}
              {tracciati.map((t) => {
                const r = perIstat.get(t.istat);
                if (!r || !t.centro || r.richieste === 0 || r.proPrecisi > 0) return null;
                return (
                  <circle
                    key={`buco-${t.istat}`}
                    cx={t.centro[0]}
                    cy={t.centro[1]}
                    r={3.4}
                    fill={BUCO}
                    stroke="#fff"
                    strokeWidth={1.2}
                    pointerEvents="none"
                  />
                );
              })}
            </svg>

            {rigaSopra && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-ink/10 bg-white/95 px-3 py-2 text-xs shadow-sm">
                <p className="font-semibold text-ink">{rigaSopra.nome}</p>
                <p className="text-ink/70">
                  {rigaSopra.proPrecisi} dichiarati · {rigaSopra.proAmpi} larghi ·{" "}
                  {rigaSopra.proBase} con base qui · {rigaSopra.richieste} richieste
                </p>
              </div>
            )}
          </div>
        )}

        <Legenda massimo={massimo} nome={etichettaMetrica.nome} quantiBuchi={buchi.length} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca un comune"
            className="rounded-lg border border-ink/20 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={soloBuchi}
              onChange={(e) => setSoloBuchi(e.target.checked)}
            />
            Solo i buchi ({buchi.length})
          </label>
          <span className="ml-auto text-sm text-ink/60">
            {visibili.length} comuni su {righe.length}
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/60">
              <tr>
                <Colonna campo="nome" ordine={ordine} su={ordinaPer}>
                  Comune
                </Colonna>
                <Colonna campo="proPrecisi" ordine={ordine} su={ordinaPer} numerica>
                  Copertura dichiarata
                </Colonna>
                <Colonna campo="proAmpi" ordine={ordine} su={ordinaPer} numerica>
                  Copertura larga
                </Colonna>
                <Colonna campo="proBase" ordine={ordine} su={ordinaPer} numerica>
                  Base qui
                </Colonna>
                <Colonna campo="richieste" ordine={ordine} su={ordinaPer} numerica>
                  Richieste
                </Colonna>
              </tr>
            </thead>
            <tbody>
              {visibili.map((r) => {
                const buco = r.richieste > 0 && r.proPrecisi === 0;
                return (
                  <tr
                    key={r.istat}
                    onMouseEnter={() => setSopra(r.istat)}
                    onMouseLeave={() => setSopra((p) => (p === r.istat ? null : p))}
                    className={`border-t border-ink/5 ${
                      sopra === r.istat ? "bg-indigo-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-ink">
                      {buco && (
                        <span
                          aria-hidden
                          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: BUCO }}
                        />
                      )}
                      {r.nome}
                      {buco && <span className="sr-only"> (buco: richieste senza copertura)</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{r.proPrecisi}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink/70">{r.proAmpi}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink/70">{r.proBase}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{r.richieste}</td>
                  </tr>
                );
              })}
              {visibili.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink/60">
                    Nessun comune.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-ink/50">
          Confini dei comuni: ISTAT via openpolis/geojson-italy, CC BY 4.0. «Copertura
          dichiarata» conta chi ha nominato questo comune o i quartieri della sua città;
          «copertura larga» chi lo prende dentro un ambito di provincia, regione o Italia.
        </p>
      </section>
    </div>
  );
}

function Tessera({ nome, valore, su }: { nome: string; valore: number; su?: number }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-ink/55">{nome}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {valore}
        {su !== undefined && <span className="text-base font-normal text-ink/50"> / {su}</span>}
      </p>
    </div>
  );
}

function Legenda({
  massimo,
  nome,
  quantiBuchi,
}: {
  massimo: number;
  nome: string;
  quantiBuchi: number;
}) {
  const passo = massimo <= SCALA.length ? 1 : massimo / SCALA.length;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink/70">
      <span className="font-medium text-ink">{nome}</span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-5 rounded-sm border border-ink/15"
          style={{ backgroundColor: ZERO }}
        />
        nessuno
      </span>
      {SCALA.map((c, i) => {
        const da = Math.round(i * passo) + 1;
        const a = Math.round((i + 1) * passo);
        return (
          <span key={c} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-5 rounded-sm border border-ink/15"
              style={{ backgroundColor: c }}
            />
            {da === a ? da : `${da}–${a}`}
            {i === SCALA.length - 1 && massimo > a ? "+" : ""}
          </span>
        );
      })}
      {quantiBuchi > 0 && (
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: BUCO }}
          />
          richieste senza copertura ({quantiBuchi})
        </span>
      )}
    </div>
  );
}

function Colonna({
  campo,
  ordine,
  su,
  numerica,
  children,
}: {
  campo: keyof ComuneRiga;
  ordine: { campo: keyof ComuneRiga; giu: boolean };
  su: (c: keyof ComuneRiga) => void;
  numerica?: boolean;
  children: React.ReactNode;
}) {
  const attiva = ordine.campo === campo;
  return (
    <th
      scope="col"
      aria-sort={attiva ? (ordine.giu ? "descending" : "ascending") : "none"}
      className={`px-3 py-2 font-medium ${numerica ? "text-right" : ""}`}
    >
      <button type="button" onClick={() => su(campo)} className="hover:text-ink">
        {children}
        {attiva && <span aria-hidden> {ordine.giu ? "▾" : "▴"}</span>}
      </button>
    </th>
  );
}

/** Un file dal browser, senza passare dal server: è già tutto qui. */
function scarica(contenuto: string, tipo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
