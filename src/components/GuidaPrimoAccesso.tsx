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
// ADESSO il giro finisce dove finisce il lavoro: dopo la spiegazione, la guida
// legge cosa manca davvero e per ognuna manda nella pagina giusta, si segna il
// punto (lib/guidaProgresso), e riprende al ritorno con una spunta verde in
// piu'. Chiude quando lo stato dice «compari nelle ricerche», non quando
// finiscono i passi. «Piu' tardi» resta sempre accanto: accompagnare non e'
// costringere.
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
import { Check } from "lucide-react";
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

/** Le quattro cose, dentro il pannello: al ritorno si vede la spunta in piu'. */
function Riepilogo({ voci }: { voci: VoceStato[] }) {
  return (
    <ul className="space-y-1.5 rounded-xl bg-black/[0.03] p-3" data-testid="guida-riepilogo">
      {voci.map((v) => (
        <li key={v.chiave} className="flex items-center gap-2 text-xs">
          <span
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
              v.fatto ? "bg-emerald-600 text-white" : "border border-black/20"
            }`}
            aria-hidden="true"
          >
            {v.fatto && <Check className="h-2.5 w-2.5" />}
          </span>
          <span className={v.fatto ? "text-bob-ink/40" : "text-bob-ink/75"}>
            {v.titolo}
          </span>
        </li>
      ))}
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
          "Questo riquadro, il primo della pagina, è il tuo lavoro in entrata: quando un cliente della tua zona cerca il tuo mestiere, la richiesta compare qui con il riassunto del problema e i pulsanti per rispondere. Adesso dice che non ce n'è nessuna, ed è vero: non ne è ancora arrivata.",
      },
      {
        id: "calendario",
        ancora: "calendario",
        titolo: "Il calendario è la tua giornata",
        testo:
          "Gli appuntamenti confermati si posano qui, all'ora giusta. Puoi aggiungerne uno tu con «+ Nuovo appuntamento» in fondo al riquadro, o cliccare direttamente un'ora libera.",
      },
      {
        id: "messaggi",
        ancora: "messaggi",
        fisso: true,
        titolo: "Le conversazioni stanno in questa bolla",
        testo:
          "In basso a destra, sempre lì mentre navighi: apre i messaggi e porta il numero dei non letti. Detto chiaro: le email di avviso non partono ancora, quindi per ora i messaggi si leggono qui dentro.",
        testoSenzaAncora:
          "Le conversazioni stanno in Messaggi, che si apre dalla bolla in basso a destra e porta il numero dei non letti. Detto chiaro: le email di avviso non partono ancora, quindi per ora si leggono lì dentro.",
      },
      {
        id: "impostazioni",
        ancora: "impostazioni",
        fisso: true,
        titolo: "Zone, orari, numero, prezzi: qui dentro",
        testo:
          "Questa rotella, in alto a destra, apre le impostazioni: è lì che dici in quali quartieri lavori, a che ora, con che numero e a che prezzo. Fra un attimo ti ci porto io, una cosa alla volta.",
        testoSenzaAncora:
          "Da telefono le impostazioni stanno nel menu ☰ in alto a destra: è lì che dici in quali quartieri lavori, a che ora, con che numero e a che prezzo. Fra un attimo ti ci porto io, una cosa alla volta.",
      },
      {
        id: "stato",
        ancora: "stato",
        titolo: "E questo dice se i clienti ti trovano",
        testo:
          "Il riquadro resta qui e risponde a una domanda sola: compari nelle ricerche? Non è un'etichetta che ti mettiamo noi — si accende da sola quando hai dichiarato di cosa ti occupi. Sotto, le cose che ti mancano.",
        contenuto: stato ? <Riepilogo voci={stato.voci} /> : undefined,
      },
    ],
    [nome, stato]
  );

  // ---- 2. Le cose che mancano: una per passo, con il link che ci porta ----
  const daFare = useMemo(
    () => (stato ? stato.voci.filter((v) => !v.fatto) : []),
    [stato]
  );

  const cose: PassoTour[] = daFare.map((v) => ({
    id: `cosa-${v.chiave}`,
    ancora: "stato",
    titolo: v.blocca ? `Ti manca questo: ${v.titolo.toLowerCase()}` : v.titolo,
    testo: `${v.conseguenza} Ci vuole un minuto e ti ci porto io: quando hai finito, in cima alla pagina trovi il link per tornare qui.`,
    contenuto: stato ? <Riepilogo voci={stato.voci} /> : undefined,
    azione: { etichetta: "Portami lì →", href: v.href },
  }));

  // ---- 3. La chiusura: dipende da come sta il profilo, non dal copione ----
  const chiusura: PassoTour = !stato
    ? {
        id: "fine",
        ancora: "stato",
        titolo: "Non riesco a controllare adesso",
        testo:
          "La connessione non mi ha risposto, quindi non ti dico cosa manca per non farti rifare cose già fatte. Il riquadro qui accanto ha un pulsante per riprovare.",
      }
    : daFare.length === 0
      ? {
          id: "fine",
          ancora: "stato",
          titolo: "Ci sei: i clienti ti trovano",
          testo:
            "Non manca niente. Da adesso le richieste della tua zona arrivano nel primo riquadro della pagina, e questo qui resta a dirti come stai messo.",
          contenuto: <Riepilogo voci={stato.voci} />,
        }
      : {
          id: "fine",
          ancora: "stato",
          titolo: stato.compare ? "Il resto quando vuoi" : "Quello che resta",
          testo: stato.compare
            ? "Quello che manca non ti nasconde: cambia quante richieste ti arrivano e come. Il riquadro resta qui con i link, non serve rifare la guida."
            : "Finché non dici di cosa ti occupi resti fuori dalle ricerche. Il riquadro resta qui con il link: quando lo fai, lo stato si accende da solo.",
          contenuto: <Riepilogo voci={stato.voci} />,
        };

  const passi = [...spiegazione, ...cose, chiusura];

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
