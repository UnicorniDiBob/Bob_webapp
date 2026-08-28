"use client";

// La guida del primissimo accesso.
//
// PERCHÉ ESISTE
// Fino a oggi un professionista che finiva l'iscrizione veniva portato dritto
// su un form di impostazioni: nessuno gli diceva dove arrivano le richieste,
// dove sta il calendario, dove leggerà i messaggi. Il gap G46 nella mappa
// diceva esattamente questo — «atterra su una dashboard vuota, nessun wizard,
// nessuna checklist, nessuna email di benvenuto». Ora l'iscrizione finisce
// nell'area di lavoro, e qui si spiega.
//
// LA REGOLA CHE SEGUE: spiega mentre chiede. Ogni tappa mostra un pezzo del
// prodotto e dice la sola cosa che serve per farlo funzionare, con il link al
// posto giusto. Niente campi da compilare dentro la guida: i campi vivono dove
// si rivedono, in /impostazioni, altrimenti una risposta data qui non si
// ritrova più.
//
// L'ULTIMA TAPPA È UNA CHECKLIST VERA, non un elenco di buone intenzioni: le
// quattro righe sono interrogate al database. «Compari nelle ricerche» è la
// domanda che conta, e la risposta arriva da professional_services e dai
// gettoni di copertura, non da una spunta che ci mettiamo noi.
//
// Vista una volta, non torna: si segna onboarding_completed_at sul profilo
// (colonna della 057). Resta il link «rivedi la guida», perché una guida che
// non si può riaprire è una guida che hai perso.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  professionalId: string;
  userId: string;
  nome: string;
  /** Chiude la guida. Il chiamante decide se segnarla come vista. */
  onChiudi: (segnaComeVista: boolean) => void;
}

interface Stato {
  servizi: number;
  aree: number;
  telefono: boolean;
  orari: number;
}

// Un riquadro per tappa: mostra la cosa di cui si parla, invece di
// descriverla. Sono div e bordi, nessuna immagine da caricare.
function RiquadroRichieste() {
  return (
    <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="h-2 w-24 rounded bg-bob-ink/20" />
        <span className="rounded-full bg-bob-indigo/10 px-2 py-0.5 text-[10px] font-semibold text-bob-indigo">
          nuova
        </span>
      </div>
      <div className="h-2 w-full rounded bg-bob-ink/10" />
      <div className="h-2 w-3/5 rounded bg-bob-ink/10" />
      <div className="flex gap-2 pt-1">
        <div className="h-5 w-20 rounded-md bg-bob-indigo/80" />
        <div className="h-5 w-16 rounded-md border border-black/10" />
      </div>
    </div>
  );
}

function RiquadroMappa() {
  const punti = [
    [22, 30],
    [38, 20],
    [52, 34],
    [64, 52],
    [34, 58],
    [76, 26],
  ];
  return (
    <div className="relative h-28 overflow-hidden rounded-lg border border-black/10 bg-[#f4f4f1]">
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bob-indigo bg-bob-indigo/10" />
      {punti.map(([x, y], i) => (
        <span
          key={i}
          className={`absolute h-2.5 w-2.5 rounded-full border ${
            i < 3
              ? "border-white bg-bob-indigo"
              : "border-black/25 bg-white"
          }`}
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </div>
  );
}

function RiquadroCalendario() {
  const barre = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="flex h-28 items-end gap-1.5 rounded-lg border border-black/10 bg-white p-3">
      {barre.map((g) => (
        <div key={g} className="flex-1 space-y-1">
          {g < 5 ? (
            <>
              <div className="h-10 rounded bg-bob-indigo/70" />
              <div className="h-4 rounded bg-bob-indigo/25" />
            </>
          ) : (
            <div className="h-3 rounded bg-bob-ink/10" />
          )}
        </div>
      ))}
    </div>
  );
}

function RiquadroMessaggi() {
  return (
    <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
      <div className="flex">
        <div className="max-w-[70%] rounded-2xl rounded-bl-sm bg-black/[0.06] px-3 py-2">
          <div className="h-2 w-24 rounded bg-bob-ink/20" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-bob-indigo px-3 py-2">
          <div className="h-2 w-16 rounded bg-white/70" />
        </div>
      </div>
      <div className="flex items-center gap-1 pt-0.5 text-[10px] font-semibold text-bob-indigo">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-bob-indigo text-[9px] text-white">
          2
        </span>
        non letti
      </div>
    </div>
  );
}

// Le tappe NON portano via dalla guida: fino a ieri ogni tappa aveva un link,
// e cliccarlo interrompeva il giro a metà (segnalato il 28/08). Le cose da
// fare si raccolgono nell'ultima tappa, dove il giro è finito e andarsene ha
// senso.
const TAPPE = [
  {
    titolo: "Qui arrivano le richieste",
    testo:
      "Questa è la tua area di lavoro. Quando un cliente della tua zona cerca il tuo mestiere, la richiesta compare qui con il riassunto del problema. Nessun contatto da comprare.",
    riquadro: <RiquadroRichieste />,
  },
  {
    titolo: "Dove lavori",
    testo:
      "Disegni il cerchio del tuo giro, o scegli i quartieri a mano. È il dato che decide a quali richieste ti proponiamo: il centro resta privato, pubblichiamo solo le zone.",
    riquadro: <RiquadroMappa />,
  },
  {
    titolo: "Il calendario",
    testo:
      "Dagli orari dipendono le proposte che facciamo ai clienti. Se li lasci vuoti, proponiamo orari standard — e possono essere ore in cui non lavori.",
    riquadro: <RiquadroCalendario />,
  },
  {
    titolo: "I messaggi",
    testo:
      "Le conversazioni stanno in Messaggi, con il contatore dei non letti in cima a ogni pagina. Detto chiaro: le email di avviso non partono ancora, quindi per ora si leggono qui dentro.",
    riquadro: <RiquadroMessaggi />,
  },
];

export default function GuidaPrimoAccesso({
  professionalId,
  userId,
  nome,
  onChiudi,
}: Props) {
  const supabase = createClient();
  const [passo, setPasso] = useState(0);
  const [stato, setStato] = useState<Stato | null>(null);
  const [nonControllabile, setNonControllabile] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const ultima = passo === TAPPE.length;

  useEffect(() => {
    let annullato = false;
    // Se la lettura non torna, la guida non deve restare a girare: dopo sei
    // secondi si dice che non si e' potuto controllare. Uno spinner eterno e'
    // il modo piu' sicuro di far chiudere la guida senza leggerla.
    const scaduto = setTimeout(() => {
      if (!annullato) setNonControllabile(true);
    }, 6000);
    (async () => {
      try {
        const [servizi, aree, telefono, orari] = await Promise.all([
          supabase
            .from("professional_services")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", professionalId),
          supabase
            .from("professional_coverage")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", professionalId),
          supabase
            .from("profile_phone")
            .select("phone")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("professional_availability")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", professionalId),
        ]);
        if (annullato) return;
        clearTimeout(scaduto);

        // ATTENZIONE: supabase-js NON lancia quando la lettura fallisce, torna
        // un oggetto con .error e i conteggi a null. Senza questo controllo una
        // rete caduta diventava «ti mancano 4 cose» a chi non gli manca
        // niente: visto succedere nella prova, con la rete bloccata.
        if (servizi.error || aree.error || telefono.error || orari.error) {
          setNonControllabile(true);
          return;
        }

        setNonControllabile(false);
        setStato({
          servizi: servizi.count ?? 0,
          aree: aree.count ?? 0,
          telefono: Boolean((telefono.data as { phone?: string } | null)?.phone),
          orari: orari.count ?? 0,
        });
      } catch {
        // Se non si riesce a leggere, si dice che non si e' riusciti: una
        // checklist che mostra tutto da fare perche' la rete e' caduta manda
        // il professionista a rifare cose che ha gia' fatto.
        if (!annullato) setNonControllabile(true);
      }
    })();
    return () => {
      annullato = true;
      clearTimeout(scaduto);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId, userId]);

  const chiudi = useCallback(
    async (segna: boolean) => {
      if (!segna) {
        onChiudi(false);
        return;
      }
      setSalvando(true);
      await supabase
        .from("professionals")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", professionalId);
      setSalvando(false);
      onChiudi(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [professionalId, onChiudi]
  );

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") chiudi(true);
      if (e.key === "ArrowRight") setPasso((p) => Math.min(p + 1, TAPPE.length));
      if (e.key === "ArrowLeft") setPasso((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [chiudi]);

  const righe = stato
    ? [
        {
          fatto: stato.servizi > 0,
          testo: "Hai detto di cosa ti occupi",
          nota: "senza questo non compari in nessuna ricerca",
          href: "/impostazioni/azienda",
        },
        {
          fatto: stato.aree > 0,
          testo: "Hai detto dove lavori",
          nota: "senza, vali per la sola città in cui ti sei iscritto",
          href: "/impostazioni/zone",
        },
        {
          fatto: stato.telefono,
          testo: "Hai lasciato un numero",
          nota: "non lo vede il cliente: serve per farti arrivare le chiamate",
          href: "/impostazioni/dati",
        },
        {
          fatto: stato.orari > 0,
          testo: "Hai messo i tuoi orari",
          nota: "senza, proponiamo orari standard",
          href: "/impostazioni/orari",
        },
      ]
    : [];

  const mancanti = righe.filter((r) => !r.fatto).length;
  const tappa = TAPPE[passo];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guida-titolo"
    >
      <div className="card w-full max-w-lg rounded-b-none p-6 sm:rounded-b-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-bob-ink/40">
              {ultima ? "Ultimo passo" : `Passo ${passo + 1} di ${TAPPE.length + 1}`}
            </p>
            {/* I pallini dicono quanto manca senza far contare: si vede
                a colpo d'occhio che il giro è corto. */}
            <div className="mt-2 flex gap-1.5" aria-hidden="true">
              {Array.from({ length: TAPPE.length + 1 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === passo
                      ? "w-6 bg-bob-indigo"
                      : i < passo
                        ? "w-1.5 bg-bob-indigo/40"
                        : "w-1.5 bg-black/10"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => chiudi(true)}
            className="-mr-1 -mt-1 rounded-lg p-1 text-bob-ink/40 transition hover:bg-black/5 hover:text-bob-ink"
            aria-label="Chiudi la guida"
            data-testid="button-chiudi-guida"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {!ultima ? (
          <>
            <h2 id="guida-titolo" className="text-xl font-bold text-bob-ink">
              {passo === 0 ? `Ci siamo, ${nome.split(" ")[0]}. ` : ""}
              {tappa.titolo}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bob-ink/65">
              {tappa.testo}
            </p>
            <div className="mt-4">{tappa.riquadro}</div>
          </>
        ) : (
          <>
            <h2 id="guida-titolo" className="text-xl font-bold text-bob-ink">
              {!stato
                ? "Cosa ti manca"
                : mancanti === 0
                  ? "Sei pronto a ricevere richieste"
                  : mancanti === 1
                    ? "Ti manca una cosa"
                    : `Ti mancano ${mancanti} cose`}
            </h2>
            <p className="mt-2 text-sm text-bob-ink/60">
              Questa lista non è un promemoria che ci siamo scritti: è quello che
              il prodotto vede davvero adesso.
            </p>
            <ul className="mt-4 space-y-2">
              {!stato && !nonControllabile && (
                <li className="flex items-center gap-2 text-sm text-bob-ink/50">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Controllo…
                </li>
              )}
              {nonControllabile && (
                <li className="text-sm text-bob-ink/60">
                  Non riesco a controllare adesso: riapri la guida più tardi dal
                  link «Rivedi la guida» in fondo all&apos;area di lavoro.
                </li>
              )}
              {righe.map((r) => (
                <li key={r.testo} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      r.fatto ? "bg-emerald-600 text-white" : "border border-black/20"
                    }`}
                    aria-hidden="true"
                  >
                    {r.fatto && <Check className="h-3 w-3" />}
                  </span>
                  <span className={r.fatto ? "text-bob-ink/50" : "text-bob-ink"}>
                    {r.testo}
                    {!r.fatto && (
                      <>
                        {" — "}
                        <span className="text-bob-ink/50">{r.nota}. </span>
                        <Link
                          href={r.href}
                          className="font-medium text-bob-indigo hover:underline"
                          onClick={() => chiudi(true)}
                        >
                          Fallo ora
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (passo === 0 ? chiudi(true) : setPasso(passo - 1))}
            className="text-sm font-medium text-bob-ink/50 transition hover:text-bob-ink"
          >
            {passo === 0 ? "Salta" : "Indietro"}
          </button>
          <button
            type="button"
            onClick={() => (ultima ? chiudi(true) : setPasso(passo + 1))}
            disabled={salvando}
            className="btn-primary disabled:opacity-50"
            data-testid="button-avanti-guida"
          >
            {ultima ? (salvando ? "Un attimo…" : "Iniziamo") : "Avanti"}
          </button>
        </div>
      </div>
    </div>
  );
}
