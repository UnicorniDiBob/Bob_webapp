"use client";

// Il pannello del fermo: programma, ferma adesso, riapri.
//
// QUATTRO COSE CHE QUESTA PAGINA FA APPOSTA.
//
// 1. IL FERMO RAPIDO E' PROTETTO, NON NASCOSTO. Chiudere Bob a tutti e'
//    l'azione piu' distruttiva che esista nel pannello, e deve restare a
//    portata di mano: quando serve, serve in fretta. Quindi non e' sepolta —
//    e' chiusa a chiave. Tre chiavi diverse, e nessuna e' un doppione:
//    una durata da scegliere (niente fermi senza fine), un motivo che leggera'
//    chiunque (scriverlo obbliga a pensare a cosa si sta per fare), e la
//    parola FERMA BOB battuta a mano. Un doppio clic non le supera, un gomito
//    sulla tastiera nemmeno.
//
// 2. LA DURATA E' OBBLIGATORIA ANCHE NEL FERMO RAPIDO. E' la stessa regola
//    della 073: ogni fermo si riapre da solo. Si prolunga con un gesto, si
//    riapre prima con un gesto — quello che non si puo' fare e' lasciarlo
//    acceso per dimenticanza.
//
// 3. IL PREAVVISO SI CREA QUI, NON ALTROVE. Programmare una manutenzione senza
//    dirlo e' la meta' del lavoro: la seconda meta' e' un avviso della 071 che
//    parte prima e si spegne da solo quando il fermo comincia. Una casella nel
//    modulo, non una seconda pagina da ricordarsi.
//
// 4. SI VEDE COM'E' SCRITTO PRIMA. Il motivo finisce sulla pagina che vedono
//    tutti, compresi i motori di ricerca. L'anteprima costa niente.

import { useCallback, useEffect, useMemo, useState } from "react";
import { PowerOff, CalendarClock, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { quandoLeggibile, type Manutenzione } from "@/lib/manutenzione";
import { ContoAllaRovescia } from "@/components/ContoAllaRovescia";

interface Riga extends Manutenzione {
  immediata: boolean;
  annullata_il: string | null;
  avviso_id: string | null;
  creato_il: string;
}

/** La parola che sblocca il fermo immediato. Battuta a mano, non incollabile
 *  per sbaglio da nessun flusso normale. */
const PAROLA = "FERMA BOB";

const DURATE = [
  { minuti: 15, etichetta: "15 minuti" },
  { minuti: 30, etichetta: "30 minuti" },
  { minuti: 60, etichetta: "1 ora" },
  { minuti: 120, etichetta: "2 ore" },
  { minuti: 240, etichetta: "4 ore" },
];

const PREAVVISI = [
  { ore: 0, etichetta: "Nessun preavviso" },
  { ore: 2, etichetta: "2 ore prima" },
  { ore: 12, etichetta: "12 ore prima" },
  { ore: 24, etichetta: "24 ore prima" },
  { ore: 72, etichetta: "3 giorni prima" },
];

const MAX_ORE = 24;

function perInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

function leggibile(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stato(r: Riga): { testo: string; classe: string } {
  const ora = Date.now();
  if (r.annullata_il) return { testo: "Annullata", classe: "bg-black/5 text-bob-ink/50" };
  if (new Date(r.fine_il).getTime() <= ora) {
    return { testo: "Finita", classe: "bg-black/5 text-bob-ink/50" };
  }
  if (new Date(r.inizio_il).getTime() > ora) {
    return { testo: "Programmata", classe: "bg-amber-50 text-amber-700" };
  }
  return { testo: "Sito fermo", classe: "bg-red-50 text-red-700" };
}

/** Gli errori del database, detti come li capisce una persona. */
function spiegaErrore(codice: string | undefined, messaggio: string): string {
  if (codice === "23P01" || /exclusion|sovrappo/i.test(messaggio)) {
    return "C'è già una finestra che si sovrappone a questa. Riapri o annulla quella prima.";
  }
  if (codice === "23514") {
    return "Il database ha rifiutato la finestra: controlla che duri fra un minuto e 24 ore e che il motivo sia lungo almeno 10 caratteri.";
  }
  if (codice === "42501") {
    return "Il database dice che non hai i permessi. Serve il ruolo admin.";
  }
  return "Non ci sono riuscito. Riprova.";
}

export function ManutenzioneAdmin() {
  const supabase = createClient();
  const { user } = useAuth();

  const [righe, setRighe] = useState<Riga[]>([]);
  const [caricate, setCaricate] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // --- fermo rapido ---
  const [apertoRapido, setApertoRapido] = useState(false);
  const [durata, setDurata] = useState(30);
  const [motivoRapido, setMotivoRapido] = useState("");
  const [conferma, setConferma] = useState("");

  // --- programmata ---
  const [inizio, setInizio] = useState(() =>
    perInput(new Date(Date.now() + 24 * 3600 * 1000))
  );
  const [fine, setFine] = useState(() =>
    perInput(new Date(Date.now() + 25 * 3600 * 1000))
  );
  const [motivo, setMotivo] = useState("");
  const [dettaglio, setDettaglio] = useState("");
  const [preavviso, setPreavviso] = useState(24);

  const carica = useCallback(async () => {
    const { data, error } = await supabase
      .from("manutenzioni")
      .select(
        "id, motivo, dettaglio, inizio_il, fine_il, immediata, annullata_il, avviso_id, creato_il"
      )
      .order("inizio_il", { ascending: false })
      .limit(30);
    if (error) {
      setErrore("Non riesco a leggere le manutenzioni. Ricarica la pagina.");
      setCaricate(true);
      return;
    }
    setRighe((data ?? []) as Riga[]);
    setCaricate(true);
  }, [supabase]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const inCorso = useMemo(
    () => righe.find((r) => stato(r).testo === "Sito fermo") ?? null,
    [righe]
  );

  // ------------------------------------------------------------------
  // Fermo rapido
  // ------------------------------------------------------------------

  const motivoRapidoPulito = motivoRapido.trim();
  const rapidoPronto =
    motivoRapidoPulito.length >= 10 &&
    motivoRapidoPulito.length <= 300 &&
    conferma.trim().toUpperCase() === PAROLA &&
    !salvando;

  async function fermaAdesso() {
    if (!rapidoPronto || !user) return;
    setSalvando(true);
    setErrore(null);
    const ora = new Date();
    const { error } = await supabase.from("manutenzioni").insert({
      motivo: motivoRapidoPulito,
      inizio_il: ora.toISOString(),
      fine_il: new Date(ora.getTime() + durata * 60000).toISOString(),
      immediata: true,
      creato_da: user.id,
    });
    if (error) {
      setErrore(spiegaErrore(error.code, error.message));
      setSalvando(false);
      return;
    }
    setApertoRapido(false);
    setMotivoRapido("");
    setConferma("");
    await carica();
    setSalvando(false);
  }

  // ------------------------------------------------------------------
  // Programmata
  // ------------------------------------------------------------------

  const inizioData = useMemo(() => new Date(inizio), [inizio]);
  const fineData = useMemo(() => new Date(fine), [fine]);
  const motivoPulito = motivo.trim();
  const dettaglioPulito = dettaglio.trim();

  const problema: string | null = (() => {
    if (motivoPulito.length < 10) return "Il motivo deve dire qualcosa: almeno 10 caratteri.";
    if (motivoPulito.length > 300) return "Il motivo supera i 300 caratteri.";
    if (dettaglioPulito.length > 2000) return "Il dettaglio supera i 2000 caratteri.";
    if (isNaN(inizioData.getTime()) || isNaN(fineData.getTime())) {
      return "Le date non sono valide.";
    }
    if (fineData <= inizioData) return "La fine deve venire dopo l'inizio.";
    if (fineData.getTime() - inizioData.getTime() > MAX_ORE * 3600 * 1000) {
      return `Una finestra non può durare più di ${MAX_ORE} ore. Se serve, si prolunga mentre è in corso.`;
    }
    return null;
  })();

  async function programma() {
    if (problema || salvando || !user) return;
    setSalvando(true);
    setErrore(null);

    // Il preavviso PRIMA della finestra: se fallisce lui, non ha senso
    // programmare un fermo silenzioso e credere di aver avvisato.
    let avvisoId: string | null = null;
    const iniziaFra = inizioData.getTime() - Date.now();
    if (preavviso > 0 && iniziaFra > 60_000) {
      const da = new Date(
        Math.max(Date.now(), inizioData.getTime() - preavviso * 3600 * 1000)
      );
      const testo =
        `Bob si ferma per manutenzione ${quandoLeggibile(inizioData.toISOString())} ` +
        `e torna ${quandoLeggibile(fineData.toISOString())}.\n\n${motivoPulito}` +
        (dettaglioPulito ? `\n\n${dettaglioPulito}` : "") +
        `\n\nLe richieste e i messaggi già inviati non si perdono.`;
      const { data: avviso, error: erroreAvviso } = await supabase
        .from("avvisi_servizio")
        .insert({
          titolo: "Manutenzione programmata",
          testo: testo.slice(0, 2000),
          livello: "attenzione",
          inizio_il: da.toISOString(),
          fine_il: inizioData.toISOString(),
          creato_da: user.id,
        })
        .select("id")
        .single();
      if (erroreAvviso) {
        setErrore(
          "Non sono riuscito a pubblicare il preavviso, quindi non ho programmato niente: " +
            spiegaErrore(erroreAvviso.code, erroreAvviso.message)
        );
        setSalvando(false);
        return;
      }
      avvisoId = avviso?.id ?? null;
    }

    const { error } = await supabase.from("manutenzioni").insert({
      motivo: motivoPulito,
      dettaglio: dettaglioPulito || null,
      inizio_il: inizioData.toISOString(),
      fine_il: fineData.toISOString(),
      immediata: false,
      avviso_id: avvisoId,
      creato_da: user.id,
    });
    if (error) {
      // Il preavviso e' gia' fuori: dirlo, invece di lasciare un avviso
      // orfano che annuncia una manutenzione che non esiste.
      if (avvisoId) {
        await supabase
          .from("avvisi_servizio")
          .update({ fine_il: new Date().toISOString() })
          .eq("id", avvisoId);
      }
      setErrore(spiegaErrore(error.code, error.message));
      setSalvando(false);
      return;
    }
    setMotivo("");
    setDettaglio("");
    await carica();
    setSalvando(false);
  }

  // ------------------------------------------------------------------
  // Riapri / prolunga / annulla
  // ------------------------------------------------------------------

  async function riapri(r: Riga) {
    setErrore(null);
    const { error } = await supabase
      .from("manutenzioni")
      .update({
        fine_il: new Date().toISOString(),
        aggiornato_il: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) {
      setErrore(spiegaErrore(error.code, error.message));
      return;
    }
    await carica();
  }

  async function prolunga(r: Riga, minuti: number) {
    setErrore(null);
    const nuova = new Date(new Date(r.fine_il).getTime() + minuti * 60000);
    const tetto = new Date(r.inizio_il).getTime() + MAX_ORE * 3600 * 1000;
    if (nuova.getTime() > tetto) {
      setErrore(
        `Questa finestra arriverebbe oltre le ${MAX_ORE} ore. Chiudila e aprine un'altra: un fermo che dura un giorno intero va deciso, non prolungato.`
      );
      return;
    }
    const { error } = await supabase
      .from("manutenzioni")
      .update({
        fine_il: nuova.toISOString(),
        aggiornato_il: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) {
      setErrore(spiegaErrore(error.code, error.message));
      return;
    }
    await carica();
  }

  async function annulla(r: Riga) {
    setErrore(null);
    const adesso = new Date().toISOString();
    const { error } = await supabase
      .from("manutenzioni")
      .update({ annullata_il: adesso, aggiornato_il: adesso })
      .eq("id", r.id);
    if (error) {
      setErrore(spiegaErrore(error.code, error.message));
      return;
    }
    // Il preavviso di una manutenzione annullata e' una bugia che resta
    // accesa: si spegne insieme a lei.
    if (r.avviso_id) {
      await supabase
        .from("avvisi_servizio")
        .update({ fine_il: adesso, aggiornato_il: adesso })
        .eq("id", r.avviso_id);
    }
    await carica();
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <span className="section-eyebrow">Admin</span>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-bob-ink">
          <PowerOff className="h-6 w-6 text-bob-ink/40" aria-hidden="true" />
          Fermo e manutenzione
        </h1>
        <p className="mt-1.5 text-sm text-bob-ink/60">
          Mentre una finestra è in corso, chi non è staff non entra da nessuna
          parte: vede una pagina di cortesia con il motivo e l&apos;ora di
          riapertura. Admin e CS continuano a lavorare normalmente.
        </p>
      </header>

      {errore && (
        <p
          className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700"
          data-testid="manutenzione-errore"
        >
          {errore}
        </p>
      )}

      {/* --- lo stato adesso, in cima e senza doverlo cercare --- */}
      {inCorso && (
        <section
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5"
          data-testid="fermo-in-corso"
        >
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-700">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Bob è fermo adesso
          </p>
          <p className="mt-2 text-sm text-bob-ink/80">{inCorso.motivo}</p>
          <p className="mt-1 text-sm text-bob-ink/60">
            Riapre da solo <ContoAllaRovescia fine={inCorso.fine_il} />, alle{" "}
            {new Date(inCorso.fine_il).toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => riapri(inCorso)}
              className="btn-primary py-2 text-sm"
              data-testid="riapri-adesso"
            >
              Riapri adesso
            </button>
            <button
              type="button"
              onClick={() => prolunga(inCorso, 30)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-bob-ink hover:border-black/25"
              data-testid="prolunga-30"
            >
              Prolunga di 30 minuti
            </button>
          </div>
        </section>
      )}

      {/* --- fermo rapido, sotto tre chiavi --- */}
      <section className="card p-5" data-testid="fermo-rapido">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-bob-ink">
          <PowerOff className="h-4 w-4 text-red-600" aria-hidden="true" />
          Ferma Bob adesso
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
          Per quando qualcosa è già andato storto e il sito deve chiudere subito.
          Ha effetto entro dieci secondi su tutte le pagine e su tutte le API.
          Riapre da solo alla scadenza che scegli.
        </p>

        {!apertoRapido ? (
          <button
            type="button"
            onClick={() => {
              setErrore(null);
              setApertoRapido(true);
            }}
            className="mt-3 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-bob-ink transition hover:border-red-300 hover:text-red-600"
            data-testid="apri-fermo-rapido"
          >
            Preparo il fermo
          </button>
        ) : (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
            <fieldset>
              <legend className="label-bob">Per quanto</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {DURATE.map((d) => (
                  <button
                    key={d.minuti}
                    type="button"
                    onClick={() => setDurata(d.minuti)}
                    className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                      durata === d.minuti
                        ? "border-bob-indigo bg-white text-bob-indigo"
                        : "border-black/10 bg-white/60 text-bob-ink/70 hover:border-black/25"
                    }`}
                  >
                    {d.etichetta}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-bob-ink/50">
                Si prolunga e si riapre in un clic. Quello che non si può fare è
                lasciarlo acceso per dimenticanza.
              </p>
            </fieldset>

            <div className="mt-4">
              <label className="label-bob" htmlFor="rapido-motivo">
                Cosa scriviamo sulla porta
              </label>
              <input
                id="rapido-motivo"
                className="input-bob"
                value={motivoRapido}
                onChange={(e) => setMotivoRapido(e.target.value)}
                placeholder="Stiamo risolvendo un problema tecnico: torniamo il prima possibile."
                maxLength={300}
                data-testid="rapido-motivo"
              />
              <p className="mt-1 text-xs text-bob-ink/45">
                Lo legge chiunque arrivi sul sito, anche chi non è registrato e
                anche i motori di ricerca. Niente di interno.
              </p>
            </div>

            <div className="mt-4">
              <label className="label-bob" htmlFor="rapido-conferma">
                Scrivi <span className="font-mono font-bold">{PAROLA}</span> per
                sbloccare
              </label>
              <input
                id="rapido-conferma"
                className="input-bob font-mono"
                value={conferma}
                onChange={(e) => setConferma(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={PAROLA}
                data-testid="rapido-conferma"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fermaAdesso}
                disabled={!rapidoPronto}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
                data-testid="conferma-fermo-rapido"
              >
                {salvando
                  ? "Fermo…"
                  : `Ferma Bob per ${
                      DURATE.find((d) => d.minuti === durata)?.etichetta ?? ""
                    }`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setApertoRapido(false);
                  setConferma("");
                }}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-bob-ink transition hover:border-black/25"
              >
                Lascia tutto com&apos;è
              </button>
            </div>
          </div>
        )}
      </section>

      {/* --- programmata --- */}
      <section className="card mt-6 p-5" data-testid="programma-manutenzione">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-bob-ink">
          <CalendarClock className="h-4 w-4 text-bob-ink/40" aria-hidden="true" />
          Programma una manutenzione
        </h2>
        <p className="mt-1.5 text-sm text-bob-ink/60">
          Scegli quando, scrivi cosa vedranno, e decidi con quanto anticipo
          avvisare. Il preavviso è un avviso di servizio vero: finestra al primo
          accesso, poi nella campanella, e si spegne da solo quando il fermo
          comincia.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-bob" htmlFor="man-inizio">
                Da quando
              </label>
              <input
                id="man-inizio"
                type="datetime-local"
                className="input-bob"
                value={inizio}
                onChange={(e) => setInizio(e.target.value)}
              />
            </div>
            <div>
              <label className="label-bob" htmlFor="man-fine">
                Fino a quando
              </label>
              <input
                id="man-fine"
                type="datetime-local"
                className="input-bob"
                value={fine}
                onChange={(e) => setFine(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label-bob" htmlFor="man-motivo">
              Cosa scriviamo sulla porta
            </label>
            <input
              id="man-motivo"
              className="input-bob"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Aggiorniamo il sistema: durante questo intervallo Bob non è raggiungibile."
              maxLength={300}
              data-testid="man-motivo"
            />
          </div>

          <div>
            <label className="label-bob" htmlFor="man-dettaglio">
              Dettaglio (facoltativo)
            </label>
            <textarea
              id="man-dettaglio"
              className="input-bob min-h-[90px] resize-y"
              value={dettaglio}
              onChange={(e) => setDettaglio(e.target.value)}
              placeholder="Le richieste e gli appuntamenti già confermati non cambiano."
              maxLength={2000}
            />
          </div>

          <div>
            <label className="label-bob" htmlFor="man-preavviso">
              Avvisa gli utenti
            </label>
            <select
              id="man-preavviso"
              className="input-bob"
              value={preavviso}
              onChange={(e) => setPreavviso(Number(e.target.value))}
              data-testid="man-preavviso"
            >
              {PREAVVISI.map((p) => (
                <option key={p.ore} value={p.ore}>
                  {p.etichetta}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-bob-ink/45">
              La fascia in cima al sito la vedono tutti, registrati o no, da 48
              ore prima. Questa scelta riguarda la finestra al primo accesso,
              che vedono solo gli utenti con un account.
            </p>
          </div>

          {motivoPulito && (
            <div>
              <p className="label-bob">Come la vedono</p>
              <div className="mt-1 rounded-xl border border-black/10 bg-black/[0.015] p-3.5">
                <p className="text-sm font-semibold text-bob-ink">
                  Ci fermiamo un momento
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/75">
                  {motivoPulito}
                </p>
                {dettaglioPulito && (
                  <p className="mt-1.5 whitespace-pre-line text-sm text-bob-ink/60">
                    {dettaglioPulito}
                  </p>
                )}
                {!isNaN(fineData.getTime()) && (
                  <p className="mt-2 text-sm font-semibold text-bob-indigo">
                    Torniamo {quandoLeggibile(fineData.toISOString())}.
                  </p>
                )}
              </div>
            </div>
          )}

          {problema && motivoPulito && (
            <p className="text-sm text-amber-700">{problema}</p>
          )}

          <div>
            <button
              type="button"
              onClick={programma}
              disabled={Boolean(problema) || salvando}
              className="btn-primary py-2.5 disabled:opacity-50"
              data-testid="man-programma"
            >
              {salvando ? "Programmo…" : "Programma il fermo"}
            </button>
          </div>
        </div>
      </section>

      {/* --- elenco --- */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
          Le finestre
        </h2>
        {!caricate ? (
          <p className="text-sm text-bob-ink/50">Carico…</p>
        ) : righe.length === 0 ? (
          <div className="card p-6 text-sm text-bob-ink/55">
            Bob non si è mai fermato.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {righe.map((r) => {
              const s = stato(r);
              const futura = s.testo === "Programmata";
              const adesso = s.testo === "Sito fermo";
              return (
                <li
                  key={r.id}
                  className="card flex items-start gap-3 px-4 py-3"
                  data-testid={`manutenzione-riga-${r.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.classe}`}
                      >
                        {s.testo}
                      </span>
                      {r.immediata && (
                        <span className="text-[11px] text-bob-ink/45">
                          fermo rapido
                        </span>
                      )}
                      {r.avviso_id && (
                        <span className="text-[11px] text-bob-ink/45">
                          con preavviso
                        </span>
                      )}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-bob-ink/70">
                      {r.motivo}
                    </p>
                    <p className="mt-1 text-xs text-bob-ink/45">
                      {leggibile(r.inizio_il)} → {leggibile(r.fine_il)}
                    </p>
                  </div>
                  {adesso && (
                    <button
                      type="button"
                      onClick={() => riapri(r)}
                      className="shrink-0 rounded-xl border border-black/10 px-3 py-1.5 text-xs font-medium text-bob-ink/60 hover:border-emerald-300 hover:text-emerald-700"
                    >
                      Riapri adesso
                    </button>
                  )}
                  {futura && (
                    <button
                      type="button"
                      onClick={() => annulla(r)}
                      className="shrink-0 rounded-xl border border-black/10 px-3 py-1.5 text-xs font-medium text-bob-ink/60 hover:border-red-300 hover:text-red-600"
                      data-testid={`annulla-${r.id}`}
                    >
                      Annulla
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
