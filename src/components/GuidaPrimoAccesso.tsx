"use client";

// LA GUIDA DEL PRIMO ACCESSO — spiega la pagina, poi non ti molla.
//
// PERCHE' ESISTE. Un professionista che finiva l'iscrizione atterrava su una
// dashboard vuota: nessuno gli diceva dove arrivano le richieste, dove sta il
// calendario, dove leggera' i messaggi (gap G46 della mappa).
//
// LE DUE RISCRITTURE, in ordine, perche' l'errore di ognuna e' istruttivo.
//
// 28/08 — cinque tappe con finti riquadri grigi accanto alle frasi. Sembravano
// un prodotto, non erano il prodotto: chi li guardava non imparava dove
// stessero le cose, perche' quelle cose non erano quelle.
//
// 29/08 — ogni passo illumina l'elemento vero della pagina (data-tour=...): il
// buco nell'ombra e' la pagina stessa. Meglio, ma finiva ancora dove finivano
// le schermate: cinque spiegazioni, un saluto, e un professionista che restava
// invisibile ai clienti esattamente come prima.
//
// 29/08 — ogni passo illumina l'elemento vero, e dopo la spiegazione la guida
// manda a sistemare cio' che manca. Giusto nella sostanza, sbagliato nella
// forma: una tappa per ogni cosa mancante, tutte ancorate allo STESSO
// riquadro. Chi si iscriveva ne vedeva quattro piu' una di chiusura, cinque
// passi in fila che illuminavano lo stesso rettangolo.
//
// 30/08 — un passo per ogni cosa vera della pagina, e uno solo per lo stato:
// dentro c'e' la lista, e ogni riga che manca e' un link. Sei passi in tutto
// invece di undici, e ognuno mostra qualcosa di diverso. Chiude quando lo
// stato dice «compari nelle ricerche», non quando finiscono i passi. «Piu'
// tardi» resta sempre accanto: accompagnare non e' costringere.
//
// COSA NON STA QUI. I campi da compilare: vivono in /impostazioni, dove poi si
// rivedono. Averli anche qui vorrebbe dire due posti che scrivono lo stesso
// dato, e prima o poi uno dei due divergerebbe. La guida ci porta, non li
// duplica.
//
// L'unica scrittura sul server e' onboarding_completed_at (colonna della 057):
// serve a non riproporre il giro da solo. Il ritorno lo governa il segnaposto.

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TourAncorato, type PassoTour } from "@/components/TourAncorato";
import { useStatoProfilo, type VoceStato } from "@/lib/useStatoProfilo";
import { scriviProgresso } from "@/lib/guidaProgresso";

interface Props {
  professionalId: string;
  userId: string;
  nome: string;
  /** Si riprende dalle cose da fare: la spiegazione e' gia' stata vista. */
  riprendi?: boolean;
  /** Chiude la guida. Il chiamante decide se segnarla come vista. */
  onChiudi: (segnaComeVista: boolean) => void;
}

/**
 * Le quattro cose, dentro il pannello. Quando riceve onVai, ogni riga non
 * ancora fatta e' cliccabile: e' cosi' che quattro passi diventano un passo
 * solo senza perdere niente per strada.
 */
function Riepilogo({
  voci,
  onVai,
}: {
  voci: VoceStato[];
  onVai?: (href: string) => void;
}) {
  return (
    <ul className="space-y-1 rounded-xl bg-black/[0.03] p-2" data-testid="guida-riepilogo">
      {voci.map((v) => {
        const spunta = (
          <span
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
              v.fatto ? "bg-emerald-600 text-white" : "border border-black/20"
            }`}
            aria-hidden="true"
          >
            {v.fatto && <Check className="h-2.5 w-2.5" />}
          </span>
        );
        if (v.fatto || !onVai) {
          return (
            <li
              key={v.chiave}
              className="flex items-center gap-2 px-1.5 py-1 text-xs"
            >
              {spunta}
              <span className={v.fatto ? "text-bob-ink/40" : "text-bob-ink/75"}>
                {v.titolo}
              </span>
            </li>
          );
        }
        return (
          <li key={v.chiave}>
            <button
              type="button"
              onClick={() => onVai(v.href)}
              data-testid={`guida-vai-${v.chiave}`}
              className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs hover:bg-black/[0.04]"
            >
              {spunta}
              <span className="flex-1 text-bob-ink/75">{v.titolo}</span>
              <span className="shrink-0 font-semibold text-bob-indigo">
                Sistemalo <ArrowRight className="inline h-3 w-3" />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function GuidaPrimoAccesso({
  professionalId,
  userId,
  nome,
  riprendi = false,
  onChiudi,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { esito } = useStatoProfilo(professionalId, userId);
  const [salvando, setSalvando] = useState(false);

  const stato = esito.fase === "letto" ? esito.stato : null;

  const segnaVista = useCallback(async () => {
    await supabase
      .from("professionals")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", professionalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  // ---- 1. La pagina: cinque cose vere, illuminate dove stanno ----
  const spiegazione: PassoTour[] = useMemo(
    () => [
      {
        id: "richieste",
        ancora: "richieste",
        titolo: `Ci siamo, ${nome.split(" ")[0]}. Qui arrivano le richieste`,
        testo:
          "Quando un cliente della tua zona cerca il tuo mestiere, la richiesta compare qui: il riassunto del problema e i pulsanti per rispondere. Adesso è vuoto perché non ne è ancora arrivata nessuna.",
      },
      {
        id: "calendario",
        ancora: "calendario",
        titolo: "Il calendario è la tua giornata",
        testo:
          "Gli appuntamenti confermati si posano qui, all'ora giusta. Ne aggiungi uno tu cliccando un'ora libera.",
      },
      {
        id: "messaggi",
        ancora: "messaggi",
        fisso: true,
        titolo: "Le conversazioni stanno in questa bolla",
        testo:
          "In basso a destra, sempre lì mentre navighi, con il numero dei non letti. Le email di avviso non partono ancora: per ora i messaggi si leggono qui dentro.",
        testoSenzaAncora:
          "Le conversazioni stanno in Messaggi, la bolla in basso a destra, con il numero dei non letti. Le email di avviso non partono ancora: per ora si leggono lì dentro.",
      },
      {
        // Il passo nuovo del 30/08: la campanella non si spiega da sola,
        // perche' il suo contenuto prima viveva sparso in quattro pagine e
        // nessuno lo cercava in un unico posto.
        id: "notifiche",
        ancora: "notifiche",
        fisso: true,
        titolo: "Quando siamo noi a doverti dire qualcosa",
        testo:
          "Verifica della partita IVA, risposte dell'assistenza, e il motivo per cui — se succede — non compari nelle ricerche. Il pallino resta acceso finché la cosa non è sistemata, non finché non l'hai guardata.",
        testoSenzaAncora:
          "Verifica della partita IVA, risposte dell'assistenza, il motivo per cui non compari: sono in Notifiche, nel menu ☰ in alto a destra.",
      },
      {
        id: "impostazioni",
        ancora: "impostazioni",
        fisso: true,
        titolo: "Zone, orari, numero, prezzi: qui dentro",
        testo:
          "Da qui: in quali quartieri lavori, a che ora, con che numero e a che prezzo. Fra un attimo ti ci porto io.",
        testoSenzaAncora:
          "Le impostazioni stanno nel menu ☰ in alto a destra: quartieri, orari, numero e prezzi. Fra un attimo ti ci porto io.",
      },
      {
        id: "stato",
        ancora: "stato",
        titolo: "E questo dice se i clienti ti trovano",
        testo:
          "Risponde a una domanda sola: compari nelle ricerche? Si accende da sola quando hai dichiarato di cosa ti occupi.",
      },
    ],
    [nome]
  );

  // ---- 2. Le cose che mancano: UN passo solo, non uno per cosa ----
  //
  // COM'ERA (fino al 30/08). Una tappa per ogni voce mancante, tutte ancorate
  // allo stesso riquadro «stato», piu' una tappa di chiusura ancorata ancora
  // li'. Un profilo appena iscritto ne aveva quattro piu' una: cinque passi di
  // fila che illuminavano lo stesso rettangolo, con il pallino della guida che
  // avanzava senza che sullo schermo cambiasse niente. Segnalato da Lucio: «mi
  // sembra inutile avere le ultime 4 voci del tutorial per una unica sezione».
  //
  // COM'E' ADESSO. Un passo per ogni cosa vera della pagina, e uno solo per il
  // riquadro dello stato: dentro c'e' la lista, e ogni riga che manca e' un
  // link che porta a sistemarla. Le cose da fare non sono sparite — sono nel
  // posto in cui il professionista le ritrovera' anche dopo, cioe' dentro il
  // riquadro, invece che in una fila di passi che si vede una volta sola.
  const daFare = useMemo(
    () => (stato ? stato.voci.filter((v) => !v.fatto) : []),
    [stato]
  );

  const esci = useCallback(
    async (segna: boolean) => {
      scriviProgresso(null);
      if (!segna) {
        onChiudi(false);
        return;
      }
      setSalvando(true);
      await segnaVista();
      setSalvando(false);
      onChiudi(true);
    },
    [onChiudi, segnaVista]
  );

  // Il passaggio di consegne: si segna il punto, si smette di riaprire da soli,
  // e si va. Il ritorno lo governa la barra sulle impostazioni.
  const vaiA = useCallback(
    (href: string) => {
      const voce = daFare.find((v) => v.href === href);
      scriviProgresso({
        attiva: true,
        spiegazioneVista: true,
        etichetta: voce?.titolo,
      });
      void segnaVista();
      router.push(href);
    },
    [daFare, router, segnaVista]
  );

  // ---- 3. L'ultimo passo: dipende da come sta il profilo, non dal copione ----
  const finale: PassoTour = useMemo(() => {
    if (!stato) {
      return {
        id: "fine",
        ancora: "stato",
        titolo: "Non riesco a controllare adesso",
        testo:
          "La connessione non mi ha risposto, quindi non ti dico cosa manca per non farti rifare cose gia' fatte. Il riquadro qui accanto ha un pulsante per riprovare.",
      };
    }
    if (daFare.length === 0) {
      return {
        id: "fine",
        ancora: "stato",
        titolo: "Ci sei: i clienti ti trovano",
        testo:
          "Non manca niente. Le richieste della tua zona arrivano nel primo riquadro della pagina, e questo resta a dirti come stai messo.",
        contenuto: <Riepilogo voci={stato.voci} />,
      };
    }
    // Il bottone principale punta alla cosa che pesa di piu': quella che
    // nasconde, se c'e'; altrimenti la prima della lista.
    const prima = daFare.find((v) => v.blocca) ?? daFare[0];
    return {
      id: "fine",
      ancora: "stato",
      titolo: stato.compare ? "Ti resta questo" : "Perche' non compari ancora",
      testo: stato.motivo
        ? `${stato.motivo} Le altre cose non ti nascondono: cambiano quante richieste ti arrivano e come. Tocca una riga e ti ci porto io.`
        : "Tocca una riga e ti porto dove si sistema. Quando torni, la spunta e' gia' verde.",
      contenuto: <Riepilogo voci={stato.voci} onVai={vaiA} />,
      azione: { etichetta: `${prima.titolo} →`, href: prima.href },
    };
  }, [stato, daFare, vaiA]);

  // L'elenco dei passi deve avere un'identita' stabile: TourAncorato ci
  // appende sopra scrollTo e rimisure, e un array nuovo a ogni render gli
  // faceva ripartire lo scorrimento animato in continuazione.
  const passi = useMemo(() => [...spiegazione, finale], [spiegazione, finale]);

  // Finche' non so cosa manca non apro: un giro che cambia numero di passi
  // mentre lo stai guardando e' un giro di cui non ti fidi piu'.
  if (esito.fase === "carico") return null;

  return (
    <TourAncorato
      passi={passi}
      etichettaFine="Iniziamo"
      occupato={salvando}
      indiceIniziale={riprendi ? spiegazione.length : 0}
      onAzione={vaiA}
      onEsci={esci}
    />
  );
}
