"use client";

// LA RIGA DI UN APPUNTAMENTO, LATO CLIENTE (15/10: esce da CustomerHome,
// identica). La usano «Prossimi appuntamenti» in dashboard e la pagina della
// richiesta. Disegna il contenuto; il contenitore (un <li> nell'elenco, un
// <div> nella pagina) lo mette chi la usa, con le classi
// RIGA_APPUNTAMENTO_CLIENTE.

import { MessageCircle } from "lucide-react";
import { LinkChat } from "@/components/LinkChat";
import { EtichettaSuIcona, TASTO_ICONA } from "@/components/EtichettaSuIcona";
import { AggiungiAlCalendario } from "@/components/AggiungiAlCalendario";
import { AnnullaAppuntamento } from "@/components/AnnullaAppuntamento";
import { SpostaAppuntamento } from "@/components/SpostaAppuntamento";
import { giornoVicino } from "@/lib/daFareCliente";
import { fmtDayParts, type AppuntamentoCliente } from "@/lib/appuntamentoCliente";

/** Le classi del contenitore della riga (senza display: lo decide chi la usa). */
export const RIGA_APPUNTAMENTO_CLIENTE = "flex-wrap items-center gap-3";

export function RigaAppuntamentoCliente({
  a,
  titolo,
  nomePro,
  onCambiato,
}: {
  a: AppuntamentoCliente;
  /** Il titolo dell'appuntamento o, se manca, il servizio della richiesta. */
  titolo: string | undefined;
  nomePro: string;
  onCambiato: () => void;
}) {
  const { dow, day, time } = fmtDayParts(a.starts_at);
  const vicino = giornoVicino(a.starts_at);
  const proposed = a.status === "proposed";
  // Il riquadro pieno dice «e' vicino ed e' deciso». Una
  // proposta resta ambra anche oggi: e' ancora da decidere.
  const pieno = vicino !== null && !proposed;
  return (
    <>
      {/* LA DATA E' CLICCABILE (05/09): apre «lo metto nel tuo
          calendario?». Prima era testo da ricopiare a mano. */}
      <AggiungiAlCalendario
        appuntamento={a}
        titoloVisibile={a.title || titolo || undefined}
        className="no-underline"
      >
        <span
          className={`block min-w-[46px] rounded-xl px-2 py-1.5 text-center ${
            proposed ? "bg-amber-50" : pieno ? "bg-bob-indigo" : "bg-bob-indigo-50"
          }`}
        >
          <span
            className={`block text-2xs font-medium ${
              proposed ? "text-amber-700" : pieno ? "text-white" : "text-bob-indigo"
            }`}
          >
            {vicino ?? dow}
          </span>
          <span
            className={`block text-base font-bold leading-tight ${
              proposed ? "text-amber-800" : pieno ? "text-white" : "text-bob-indigo"
            }`}
          >
            {day}
          </span>
        </span>
      </AggiungiAlCalendario>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-bob-ink">
          {a.title || titolo || "Appuntamento"}
        </p>
        <p className="truncate text-xs text-bob-ink/70">
          {time} · {nomePro}
        </p>
        {/* UNA DOMANDA, UN POSTO (14/10). Qui c'era un secondo
            «Conferma», uguale a quello di «Da fare ora»: due
            bottoni per la stessa risposta. Le risposte
            (Conferma / Altro orario / Rifiuta) stanno solo
            lassu'; qui resta lo stato. */}
        {proposed && (
          <span
            className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-2xs font-medium text-amber-800"
            data-testid={`appt-stato-${a.id}`}
          >
            {a.proposed_by === "customer" ? `in attesa di ${nomePro}` : "da confermare"}
          </span>
        )}
      </div>
      {/* DALLA PRENOTAZIONE ALLA SUA CHAT (05/10), e l'annullamento
          con le regole del preavviso (113): fuori si disdice da
          qui, dentro si chiama il professionista. */}
      {/* TRE ICONE DI 44px SU UNA RIGA (14/10). Con le scritte, a
          390px andavano su due righe ed erano alte 40px. Il nome
          di ogni tasto e' il suo aria-label; chi guarda lo legge
          tenendo il dito o il mouse sopra (EtichettaSuIcona). */}
      <div className="flex basis-full items-center gap-2 pl-[58px]">
        {a.request_id && (
          <EtichettaSuIcona etichetta="Apri la chat">
            <LinkChat
              href={`/messaggi?r=${a.request_id}&p=${a.professional_id}`}
              aria-label="Apri la chat"
              className={`${TASTO_ICONA} bg-bob-indigo-50 text-bob-indigo hover:bg-bob-indigo-100`}
              data-testid={`appt-chat-${a.id}`}
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </LinkChat>
          </EtichettaSuIcona>
        )}
        {/* Cambiare orario segue la regola della disdetta
            (115): fuori dal preavviso si sceglie un orario
            libero, dentro si chiama. */}
        <SpostaAppuntamento appt={a} nomeAltro={nomePro} onSpostato={onCambiato} compatto />
        <AnnullaAppuntamento
          appt={a}
          ruolo="customer"
          nomeAltro={nomePro}
          onAnnullato={onCambiato}
          compatto
        />
      </div>
    </>
  );
}
