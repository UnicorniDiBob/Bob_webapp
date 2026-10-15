"use client";

// «CONFRONTA I PROFESSIONISTI»: UNA SCHEDA PER OGNI PRO DELLA RICHIESTA (15/10).
//
// Scegliere fra chi ha risposto e' la decisione piu' importante del cliente,
// e fino a ieri era un elenchino «Confronta le risposte» dentro una scheda
// della dashboard. Qui le schede stanno una accanto all'altra e hanno le
// STESSE righe nello STESSO ordine — nome e verifica, recensioni, prezzo,
// tempo di risposta, ultimo messaggio, azioni — allineate con la subgrid:
// se a un pro manca una riga, al suo posto resta il vuoto e il prezzo
// dell'uno sta accanto al prezzo dell'altro. Una riga mancante e' anche
// un'informazione.
//
// SCEGLIERE (15/10, PR 7). Nella riga delle azioni c'e' «Scegli» sulle schede
// che lo permettono (lib/scelta.ts: chi ha risposto, mai con un pro solo,
// finche' la scelta non e' bloccata da un appuntamento confermato). Il pro
// scelto ha la sua etichetta «Scelto», non un tasto, e la sua scheda viene
// per prima; quelle archiviate escono dal confronto (le mette in fila
// RichiestaCliente).

import Link from "next/link";
import { LinkChat } from "@/components/LinkChat";
import { Stars, VerificationLevelBadge } from "@/components/ui";
import type { VerificationLevel } from "@/lib/vat";
import {
  testoPrenotato,
  testoPrezzo,
  type PrezzoRichiesta,
  type RiassuntoChat,
} from "@/lib/richiestaCliente";

export interface ProConfronto {
  id: string;
  nome: string;
  /** Un profilo spento non ha piu' una pagina pubblica: niente link. */
  attivo: boolean;
  livello: VerificationLevel;
  verificatoIl: string | null;
  media: number | null;
  nRecensioni: number;
  prezzo: PrezzoRichiesta | null;
  /** Il prezzo a cui questa richiesta e' stata prenotata con lui (15/10). */
  prenotatoA: number | null;
  /** response_time_label: e' gia' una frase intera, «Risponde in 48h». */
  risponde: string | null;
}

/** Le righe di ogni scheda: devono essere quante i figli diretti della scheda. */
const RIGHE = "row-span-6";

function quandoBreve(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function ConfrontoPro({
  requestId,
  pros,
  chat,
  chiusa,
  scelto = null,
  sceglibili = new Set<string>(),
  onScegli,
}: {
  requestId: string;
  pros: ProConfronto[];
  chat: Map<string, RiassuntoChat>;
  /** Richiesta conclusa: le chat restano, i non letti non chiedono piu' niente. */
  chiusa: boolean;
  /** Il pro scelto (120): etichetta «Scelto» al posto del tasto. */
  scelto?: string | null;
  /** Le schede con «Scegli» (sceglibili, lib/scelta.ts). */
  sceglibili?: Set<string>;
  onScegli?: (p: ProConfronto) => void;
}) {
  const colonne =
    pros.length >= 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : pros.length === 2
        ? "sm:grid-cols-2"
        : "";

  return (
    <div className={`grid grid-cols-1 gap-x-4 gap-y-2 ${colonne}`} data-testid="confronto-pro">
      {pros.map((p) => {
        const c = chat.get(p.id);
        const nonLetti = chiusa ? 0 : c?.nonLetti ?? 0;
        return (
          <article
            key={p.id}
            className={`card mb-2 grid grid-rows-subgrid gap-y-2 p-5 ${RIGHE}`}
            data-testid={`confronto-${p.id}`}
          >
            {/* 1. Nome e verifica (e «Scelto», 15/10) */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {scelto === p.id && (
                <span
                  className="rounded-full bg-bob-indigo px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-white"
                  data-testid={`confronto-scelto-${p.id}`}
                >
                  Scelto
                </span>
              )}
              {p.attivo ? (
                <Link
                  href={`/professionisti/${p.id}`}
                  className="inline-flex min-h-[44px] items-center text-base font-semibold text-bob-ink hover:text-bob-indigo hover:underline"
                >
                  {p.nome}
                </Link>
              ) : (
                <span className="inline-flex min-h-[44px] items-center text-base font-semibold text-bob-ink">
                  {p.nome}
                </span>
              )}
              {p.livello !== "none" && (
                <VerificationLevelBadge level={p.livello} verifiedAt={p.verificatoIl} compact />
              )}
            </div>

            {/* 2. Recensioni */}
            <div>
              {p.media === null ? (
                <span className="text-xs text-bob-ink/65">Ancora nessuna recensione</span>
              ) : (
                <Stars value={p.media} count={p.nRecensioni} />
              )}
            </div>

            {/* 3. Prezzo per il servizio di QUESTA richiesta: quello della
                prenotazione, se c'e', altrimenti il listino (15/10). */}
            <div className="text-sm">
              {p.prenotatoA !== null ? (
                <span className="font-semibold text-bob-ink" data-testid={`confronto-prenotato-${p.id}`}>
                  {testoPrenotato(p.prenotatoA)}
                </span>
              ) : p.prezzo ? (
                <>
                  <span className="font-semibold text-bob-ink">{testoPrezzo(p.prezzo)}</span>
                  {p.prezzo.nota && (
                    <span className="text-bob-ink/65"> · {p.prezzo.nota}</span>
                  )}
                </>
              ) : (
                <span className="text-bob-ink/65">Prezzo da concordare</span>
              )}
            </div>

            {/* 4. Tempo di risposta (vuoto se il pro non l'ha). L'etichetta e'
                gia' una frase, «Risponde in 48h»: si scrive com'e', come
                sulla scheda pubblica. Il 15/10 dal vivo si leggeva
                «Risponde di solito Risponde in 48h». */}
            <div className="text-xs text-bob-ink/70">{p.risponde}</div>

            {/* 5. L'ultimo messaggio della vostra chat */}
            <div className="flex min-w-0 items-start gap-2 text-xs">
              {c?.ultimo ? (
                <p
                  className={`min-w-0 flex-1 truncate ${
                    nonLetti > 0 ? "font-semibold text-bob-ink" : "text-bob-ink/70"
                  }`}
                >
                  <span className="text-bob-ink/65">
                    {quandoBreve(c.ultimo.created_at)} ·{" "}
                    {c.ultimo.sender_type === "customer" ? "Tu: " : ""}
                  </span>
                  {c.ultimo.message}
                </p>
              ) : (
                <p className="flex-1 text-bob-ink/65">Ancora nessun messaggio</p>
              )}
              {nonLetti > 0 && (
                <span
                  className="shrink-0 rounded-full bg-bob-indigo px-2 py-0.5 text-2xs font-bold text-white"
                  data-testid={`confronto-nonletti-${p.id}`}
                >
                  {nonLetti > 9 ? "9+" : nonLetti} nuov{nonLetti === 1 ? "o" : "i"}
                </span>
              )}
            </div>

            {/* 6. Azioni */}
            <div className="flex flex-wrap items-end gap-2 self-end">
              {/* «SCEGLI» (15/10, PR 7): accanto alla chat, sotto la stessa
                  riga per tutte le schede. Chiede prima di fare: apre la
                  finestra di conferma di RichiestaCliente. */}
              {sceglibili.has(p.id) && onScegli && (
                <button
                  type="button"
                  onClick={() => onScegli(p)}
                  className="btn-secondary min-h-[44px] w-full px-4 py-2.5"
                  data-testid={`confronto-scegli-${p.id}`}
                >
                  Scegli
                </button>
              )}
              <LinkChat
                href={`/messaggi?r=${requestId}&p=${p.id}`}
                className="btn-primary min-h-[44px] w-full px-4 py-2.5"
                data-testid={`confronto-chat-${p.id}`}
              >
                Apri la chat
              </LinkChat>
            </div>
          </article>
        );
      })}
    </div>
  );
}
