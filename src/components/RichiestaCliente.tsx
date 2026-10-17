"use client";

// LA PAGINA DI UNA RICHIESTA, LATO CLIENTE (15/10, PR 4 della dashboard).
//
// Ogni richiesta ha la sua storia intera in un posto: cosa si e' chiesto, a
// che punto e', i professionisti uno accanto all'altro, l'appuntamento, la
// chiusura e la recensione. Dalla dashboard ci si arrivera' con la PR 5.
//
// DI CHI E' (15/10). La richiesta si legge con il suo id E con il cliente
// collegato: `.eq("customer_id", user.id)`. La RLS lascerebbe leggere al pro
// le richieste che gli sono assegnate e allo staff tutte: questo filtro fa si'
// che la pagina mostri solo le proprie, e che a chiunque altro — un altro
// cliente, un pro, un id inventato — dica la stessa cosa: «non c'e' o non e'
// tua». Niente distingue «esiste ma non e' tua» da «non esiste».
//
// I dati dei pro sono quelli della scheda pubblica (data.ts, toCard), letti
// col client del browser sotto la sessione del cliente: le policy di lettura
// pubblica su professionals, professional_services e ratings sono le stesse,
// nessuna e' stata allargata.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { StatusTimeline, type StatoAppuntamento } from "@/components/StatusTimeline";
import { ConfrontoPro, type ProConfronto } from "@/components/ConfrontoPro";
import { ComEAndata } from "@/components/ComEAndata";
import { FinestraConferma } from "@/components/FinestraConferma";
import { LinkChat } from "@/components/LinkChat";
import { AltroOrario } from "@/components/AltroOrario";
import {
  RIGA_APPUNTAMENTO_CLIENTE,
  RigaAppuntamentoCliente,
} from "@/components/RigaAppuntamentoCliente";
import {
  COLONNE_APPUNTAMENTO_CLIENTE,
  useRispostaAppuntamento,
  type AppuntamentoCliente,
} from "@/lib/appuntamentoCliente";
import { nonFinito, propostaDaRispondere } from "@/lib/daFareCliente";
import { ordineConfronto, sceglibili } from "@/lib/scelta";
import {
  appuntamentoVero,
  codiceBreve,
  prezzoPerRichiesta,
  prezzoPrenotato,
  riassuntoChat,
  sembraUnId,
  type AppuntamentoStorico,
  type MessaggioChat,
  type RiassuntoChat,
  type RigaPrezzo,
} from "@/lib/richiestaCliente";
import { dataVerificaVisibile, publicVerificationLevel, type VerificationLevel } from "@/lib/vat";

interface Richiesta {
  id: string;
  status: string;
  closed_reason: string | null;
  problem_description: string | null;
  created_at: string | null;
  servizio: string | null;
  citta: string | null;
}

interface Dati {
  richiesta: Richiesta;
  pros: ProConfronto[];
  chat: Map<string, RiassuntoChat>;
  appuntamenti: AppuntamentoCliente[];
  /** Le stelle che il cliente ha dato in questa richiesta, per pro. */
  recensioni: Map<string, number>;
  /** C'e' o c'e' stato un appuntamento non annullato (per «Com'è andata?»). */
  haAppuntamento: boolean;
  /** Il pro scelto (120). */
  scelto: string | null;
  /** Le conversazioni archiviate: pro → quando (120). */
  archiviati: Map<string, string>;
  /** I pro che hanno scritto almeno un messaggio. */
  rispondenti: Set<string>;
  /** Tutti gli appuntamenti della richiesta, solo pro e stato: per «Scegli». */
  storico: { professional_id: string; status: string }[];
}

type Stato =
  | { tipo: "carica" }
  | { tipo: "errore" }
  | { tipo: "assente" }
  | { tipo: "pronta"; dati: Dati };

interface RigaPro {
  id: string;
  user_id: string;
  business_name: string | null;
  verification_status: "unverified" | "pending" | "verified";
  verification_level: VerificationLevel | null;
  verification_level_at: string | null;
  verification_badge_until: string | null;
  verification_badge_max_until: string | null;
  verification_under_review: boolean | null;
  response_time_label: string | null;
  deactivated_at: string | null;
  professional_services: RigaPrezzo[] | null;
  ratings: { score: number }[] | null;
}

const SELECT_PRO = `
  id, user_id, business_name, verification_status, verification_level,
  verification_level_at, verification_badge_until, verification_badge_max_until,
  verification_under_review, response_time_label, deactivated_at,
  professional_services ( service_id, subservice_id, min_price, max_price, price_note, subservices ( superseded_by ) ),
  ratings ( score )
`;

function fmtData(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TITOLO_SEZIONE = "text-sm font-semibold uppercase tracking-wide text-bob-ink/70";

export function RichiestaCliente({ id }: { id: string }) {
  const { user } = useAuth();
  const [stato, setStato] = useState<Stato>({ tipo: "carica" });
  const [descrizioneAperta, setDescrizioneAperta] = useState(false);
  const [altroOrarioPer, setAltroOrarioPer] = useState<AppuntamentoCliente | null>(null);
  // SCEGLI E RIAPRI (15/10, PR 7). Una finestra sola, per l'una o l'altra
  // domanda; la riga di conferma resta sotto le schede dopo il ricarico.
  const [domanda, setDomanda] = useState<{
    tipo: "scegli" | "archivia";
    pro: { id: string; nome: string };
  } | null>(null);
  const [inviando, setInviando] = useState(false);
  /** Il pro la cui conversazione si sta riaprendo (16/10): spegne il suo «Riapri». */
  const [riaprendo, setRiaprendo] = useState<string | null>(null);
  const [erroreDomanda, setErroreDomanda] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);
  const [archiviAperti, setArchiviAperti] = useState(false);

  const carica = useCallback(async () => {
    if (!user) return;
    if (!sembraUnId(id)) {
      setStato({ tipo: "assente" });
      return;
    }
    const supabase = createClient();

    const { data: r, error: errR } = await supabase
      .from("requests")
      .select(
        "id, status, closed_reason, problem_description, created_at, service_id, subservice_id, chosen_professional_id, services ( name ), cities ( name ), request_professionals ( professional_id, archived_at )"
      )
      .eq("id", id)
      .eq("customer_id", user.id)
      // «draft» = mai partita: in dashboard non c'e', qui nemmeno.
      .neq("status", "draft")
      .maybeSingle();
    if (errR) {
      setStato({ tipo: "errore" });
      return;
    }
    if (!r) {
      setStato({ tipo: "assente" });
      return;
    }
    const riga = r as unknown as {
      id: string;
      status: string;
      closed_reason: string | null;
      problem_description: string | null;
      created_at: string | null;
      service_id: string | null;
      subservice_id: string | null;
      chosen_professional_id: string | null;
      services: { name: string } | null;
      cities: { name: string } | null;
      request_professionals: { professional_id: string; archived_at: string | null }[] | null;
    };
    const proIds = (riga.request_professionals ?? []).map((x) => x.professional_id);

    const [pros, messaggi, appts, mie, storico] = await Promise.all([
      proIds.length
        ? supabase.from("professionals").select(SELECT_PRO).in("id", proIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("request_messages")
        .select("professional_id, sender_type, message, created_at, read_at")
        .eq("request_id", id),
      // La stessa finestra della dashboard (24 ore indietro), cosi' la barra
      // di stato dice la stessa cosa nei due posti.
      supabase
        .from("appointments")
        .select(COLONNE_APPUNTAMENTO_CLIENTE)
        .eq("request_id", id)
        .in("status", ["proposed", "confirmed"])
        .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order("starts_at", { ascending: true }),
      supabase
        .from("ratings")
        .select("professional_id, score")
        .eq("request_id", id)
        .eq("customer_id", user.id),
      // Tutti gli appuntamenti della richiesta, annullati compresi e senza
      // finestra (15/10): dicono se c'e' stato un lavoro vero e a che prezzo
      // si era prenotato.
      supabase
        .from("appointments")
        .select("professional_id, status, starts_at, price, created_at")
        .eq("request_id", id),
    ]);
    if (pros.error || messaggi.error || appts.error || mie.error || storico.error) {
      setStato({ tipo: "errore" });
      return;
    }

    const righePro = (pros.data ?? []) as unknown as RigaPro[];
    const storicoAppts = (storico.data ?? []) as AppuntamentoStorico[];
    const userIds = righePro.map((p) => p.user_id);
    const nomi = new Map<string, string>();
    if (userIds.length) {
      const { data: profili, error: errP } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (errP) {
        setStato({ tipo: "errore" });
        return;
      }
      for (const p of (profili ?? []) as { user_id: string; full_name: string | null }[]) {
        if (p.full_name) nomi.set(p.user_id, p.full_name);
      }
    }

    // Stesso ordine di request_professionals: e' l'ordine in cui la
    // richiesta e' arrivata ai pro, non uno deciso qui.
    const perId = new Map(righePro.map((p) => [p.id, p]));
    const proConfronto: ProConfronto[] = proIds
      .map((pid) => perId.get(pid))
      .filter((p): p is RigaPro => Boolean(p))
      .map((p) => {
        const voti = p.ratings ?? [];
        const media =
          voti.length > 0
            ? Math.round((voti.reduce((s, v) => s + v.score, 0) / voti.length) * 10) / 10
            : null;
        return {
          id: p.id,
          // Il nome che vede il cliente (065): l'attivita', poi la persona.
          nome: p.business_name?.trim() || nomi.get(p.user_id) || "Professionista",
          attivo: p.deactivated_at === null,
          livello: publicVerificationLevel(
            p.verification_level ?? "none",
            p.verification_status,
            p.verification_badge_until,
            p.verification_under_review ?? false,
            p.verification_badge_max_until
          ),
          verificatoIl: dataVerificaVisibile(p),
          media,
          nRecensioni: voti.length,
          prenotatoA: prezzoPrenotato(storicoAppts, p.id),
          prezzo: prezzoPerRichiesta(
            p.professional_services ?? [],
            riga.service_id,
            riga.subservice_id
          ),
          risponde: p.response_time_label,
        };
      });

    setStato({
      tipo: "pronta",
      dati: {
        richiesta: {
          id: riga.id,
          status: riga.status,
          closed_reason: riga.closed_reason,
          problem_description: riga.problem_description,
          created_at: riga.created_at,
          servizio: riga.services?.name ?? null,
          citta: riga.cities?.name ?? null,
        },
        pros: proConfronto,
        chat: riassuntoChat((messaggi.data ?? []) as MessaggioChat[]),
        appuntamenti: (appts.data ?? []) as AppuntamentoCliente[],
        recensioni: new Map(
          ((mie.data ?? []) as { professional_id: string; score: number }[]).map((x) => [
            x.professional_id,
            x.score,
          ])
        ),
        // Avvolta: .some() passerebbe l'indice come `adesso`.
        haAppuntamento: storicoAppts.some((a) => appuntamentoVero(a)),
        scelto: riga.chosen_professional_id,
        archiviati: new Map(
          (riga.request_professionals ?? [])
            .filter((x) => x.archived_at)
            .map((x) => [x.professional_id, x.archived_at as string])
        ),
        rispondenti: new Set(
          ((messaggi.data ?? []) as MessaggioChat[])
            .filter((m) => m.sender_type === "professional" && m.professional_id)
            .map((m) => m.professional_id as string)
        ),
        storico: storicoAppts.map((a) => ({ professional_id: a.professional_id, status: a.status })),
      },
    });
  }, [id, user]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const { rispondi, inCorso, errore: erroreRisposta } = useRispostaAppuntamento(user?.id, carica);

  // RIAPRIRE E' SILENZIOSO (16/10, migrazione 123): il pro torna a poter
  // scrivere ma non riceve niente, e sentira' il cliente solo quando il
  // cliente gli scrive davvero. Niente domanda prima: non avvisa nessuno e
  // si disfa archiviando di nuovo.
  async function riapriSubito(pro: { id: string; nome: string }) {
    setRiaprendo(pro.id);
    setFatto(null);
    try {
      const res = await fetch(`/api/richieste/${id}/riapri`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId: pro.id }),
      });
      const corpo = (await res.json().catch(() => ({}))) as { error?: string };
      setFatto(res.ok ? `Hai riaperto la conversazione con ${pro.nome}. Potete scrivervi di nuovo.` : corpo.error ?? "Non è andata. Riprova fra poco.");
      if (res.ok) await carica();
    } catch {
      setFatto("Non è andata. Riprova fra poco.");
    } finally {
      setRiaprendo(null);
    }
  }

  async function rispondiDomanda() {
    if (!domanda) return;
    setInviando(true);
    setErroreDomanda(null);
    try {
      const res = await fetch(`/api/richieste/${id}/${domanda.tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId: domanda.pro.id }),
      });
      const corpo = (await res.json().catch(() => ({}))) as { error?: string; sceltaAnnullata?: boolean };
      if (!res.ok) {
        setErroreDomanda(corpo.error ?? "Non è andata. Riprova fra poco.");
        return;
      }
      setFatto(
        domanda.tipo === "scegli"
          ? `Hai scelto ${domanda.pro.nome}. Le altre conversazioni sono archiviate.`
          : `Hai archiviato la conversazione con ${domanda.pro.nome}.${
              corpo.sceltaAnnullata ? " La scelta è annullata: puoi sceglierne un altro." : ""
            }`
      );
      setDomanda(null);
      await carica();
    } catch {
      setErroreDomanda("Non è andata. Riprova fra poco.");
    } finally {
      setInviando(false);
    }
  }

  // ARRIVARE A «COM'È ANDATA?» DALLA DASHBOARD (15/10, PR 6). Le righe di
  // «Da fare ora» portano a #com-e-andata, ma la pagina carica i dati nel
  // browser: il salto all'ancora del browser avviene quando la sezione non
  // c'e' ancora, e VaiAllAncora (nel layout) riprova solo fino a 800ms. Quando
  // la sezione c'e', ci si scorre una volta sola e il fuoco va sul titolo,
  // cosi' anche il lettore di schermo comincia da li'. Una volta: dopo «Sì, è
  // concluso» la pagina ricarica, e non deve saltare di nuovo.
  // SENZA ANIMAZIONE, SEMPRE. Misurato il 15/10 a 390px: uno scorrimento
  // «smooth» qui e i tentativi «instant» di VaiAllAncora si contendevano la
  // pagina, e la sezione finiva sotto l'intestazione (28px, 53px, 60px a
  // seconda del giro). Instant come VaiAllAncora, per le sue stesse ragioni
  // (in una scheda dietro lo smooth non parte); e cosi' chi chiede meno
  // movimento non ne ha. «auto» non basta: globals.css mette scroll-behavior
  // smooth su html.
  const saltato = useRef(false);
  const pronta = stato.tipo === "pronta";
  useEffect(() => {
    if (!pronta || saltato.current) return;
    saltato.current = true;
    if (window.location.hash !== "#com-e-andata") return;
    const sezione = document.getElementById("com-e-andata");
    if (!sezione) return;
    sezione.scrollIntoView({ behavior: "instant", block: "start" });
    sezione.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, [pronta]);

  const indietro = (
    <Link
      href="/dashboard"
      className="inline-flex min-h-[44px] items-center text-sm font-medium text-bob-indigo hover:underline"
      data-testid="richiesta-indietro"
    >
      ← I miei lavori
    </Link>
  );

  if (stato.tipo === "carica") {
    return (
      <div aria-busy="true">
        {indietro}
        <div className="mt-4 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-28 animate-pulse bg-black/[0.03]" />
          ))}
        </div>
      </div>
    );
  }

  if (stato.tipo === "errore") {
    return (
      <div>
        {indietro}
        <div className="card mt-4 p-6 text-center" role="alert" data-testid="richiesta-errore">
          <p className="text-sm text-bob-ink/80">
            Non sono riuscito a caricare la richiesta.
          </p>
          <button
            type="button"
            onClick={() => {
              setStato({ tipo: "carica" });
              void carica();
            }}
            className="btn-secondary mt-4 min-h-[44px] px-5 py-2.5"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (stato.tipo === "assente") {
    return (
      <div className="card p-6 text-center" data-testid="richiesta-assente">
        <h1 className="text-lg font-bold text-bob-ink">
          Questa richiesta non c&apos;è o non è tua
        </h1>
        <p className="mt-1 text-sm text-bob-ink/70">
          Le tue richieste le trovi tutte nella tua area personale.
        </p>
        <Link href="/dashboard" className="btn-primary mt-4 min-h-[44px] px-5 py-2.5">
          Torna a I miei lavori
        </Link>
      </div>
    );
  }

  const { richiesta, pros, chat, appuntamenti, recensioni, haAppuntamento, scelto, archiviati, rispondenti, storico } =
    stato.dati;
  const chiusa = richiesta.status === "closed";
  const descrizione = richiesta.problem_description?.trim() ?? "";
  // Una riga sola, poi «Leggi tutto»: la storia e' qui sotto, la descrizione
  // serve a ricordare di cosa si parla.
  const lunga = descrizione.length > 90 || descrizione.includes("\n");

  const statoAppuntamento: StatoAppuntamento = appuntamenti.some((a) => a.status === "confirmed")
    ? "confermato"
    : appuntamenti.some((a) => a.status === "proposed")
      ? "da-confermare"
      : null;
  const prossimo = appuntamenti.find((a) => nonFinito(a)) ?? null;
  const nomePro = (pid: string) => pros.find((p) => p.id === pid)?.nome ?? "Professionista";
  // Il confronto: lo scelto per primo, gli archiviati fuori (lib/scelta.ts).
  const archiviatiSet = new Set(archiviati.keys());
  const inConfronto = ordineConfronto(pros, scelto, archiviatiSet);
  const conScegli = sceglibili({
    chiusa,
    collegati: pros.map((p) => p.id),
    rispondenti,
    archiviati: archiviatiSet,
    scelto,
    appuntamenti: storico,
  });
  const archiviate = pros.filter((p) => archiviati.has(p.id));

  return (
    <div className="flex flex-col gap-5">
      {/* ---- 1. Intestazione ---- */}
      <header>
        {indietro}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          {richiesta.servizio ?? "Richiesta"}
          {richiesta.citta && (
            <span className="font-normal text-bob-ink/65"> · {richiesta.citta}</span>
          )}
        </h1>
        {descrizione && (
          <div className="mt-1.5">
            <p
              className={`whitespace-pre-line text-sm text-bob-ink/80 ${
                descrizioneAperta ? "" : "line-clamp-1"
              }`}
              data-testid="richiesta-descrizione"
            >
              {descrizione}
            </p>
            {lunga && (
              <button
                type="button"
                onClick={() => setDescrizioneAperta((v) => !v)}
                aria-expanded={descrizioneAperta}
                className="inline-flex min-h-[44px] items-center text-sm font-medium text-bob-indigo hover:underline"
              >
                {descrizioneAperta ? "Mostra meno" : "Leggi tutto"}
              </button>
            )}
          </div>
        )}
        {richiesta.created_at && (
          <p className="mt-1 text-xs text-bob-ink/65">
            Richiesta del {fmtData(richiesta.created_at)}
          </p>
        )}
      </header>

      {/* ---- 2. A che punto sei ---- */}
      <section className="card p-5">
        <h2 className={TITOLO_SEZIONE}>A che punto sei</h2>
        <StatusTimeline
          status={richiesta.status}
          closedReason={richiesta.closed_reason}
          appuntamento={statoAppuntamento}
          quoteCount={pros.length}
        />
      </section>

      {/* ---- 3. Confronta i professionisti ---- */}
      <section>
        <h2 className={TITOLO_SEZIONE}>
          {pros.length > 1 ? "Confronta i professionisti" : "Il professionista"}
        </h2>
        {pros.length === 0 ? (
          <p className="card mt-3 p-5 text-sm text-bob-ink/70">
            Nessun professionista ha ancora ricevuto questa richiesta.
          </p>
        ) : (
          <div className="mt-3">
            <ConfrontoPro
              requestId={richiesta.id}
              pros={inConfronto}
              chat={chat}
              chiusa={chiusa}
              scelto={scelto}
              sceglibili={conScegli}
              onScegli={(p) => {
                setErroreDomanda(null);
                setDomanda({ tipo: "scegli", pro: { id: p.id, nome: p.nome } });
              }}
              archiviabili={chiusa ? new Set() : new Set(inConfronto.map((p) => p.id))}
              onArchivia={(p) => {
                setErroreDomanda(null);
                setDomanda({ tipo: "archivia", pro: { id: p.id, nome: p.nome } });
              }}
            />
          </div>
        )}
        {fatto && (
          <p
            className="mt-1 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            role="status"
            data-testid="scelta-fatta"
          >
            {fatto}
          </p>
        )}

        {/* CONVERSAZIONI ARCHIVIATE (15/10, PR 7). Sotto le schede, chiuse
            all'inizio: sono il passato del confronto, non la scelta di oggi.
            Da qui si rileggono («Apri», in sola lettura per il pro) e si
            riaprono («Riapri»: il pro torna a poter scrivere; dal 16/10 in
            silenzio, senza messaggi di Bob — migrazione 123). */}
        {archiviate.length > 0 && (
          <div className="card mt-3 p-2" data-testid="archiviate">
            <button
              type="button"
              onClick={() => setArchiviAperti((v) => !v)}
              aria-expanded={archiviAperti}
              className="flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 text-left text-sm font-semibold text-bob-ink/80 hover:bg-black/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
              data-testid="archiviate-apri"
            >
              Conversazioni archiviate ({archiviate.length})
              <span className="text-bob-ink/65" aria-hidden="true">
                {archiviAperti ? "▲" : "▼"}
              </span>
            </button>
            {archiviAperti && (
              <ul className="flex flex-col divide-y divide-black/5 px-3">
                {archiviate.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"
                    data-testid={`archiviata-${p.id}`}
                  >
                    <span className="min-w-0 text-sm">
                      <span className="font-medium text-bob-ink">{p.nome}</span>
                      <span className="text-bob-ink/65">
                        {" "}
                        · archiviata il {fmtData(archiviati.get(p.id) ?? null)}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <LinkChat
                        href={`/messaggi?r=${richiesta.id}&p=${p.id}`}
                        className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-bob-indigo hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                      >
                        Apri
                      </LinkChat>
                      <button
                        type="button"
                        onClick={() => void riapriSubito({ id: p.id, nome: p.nome })}
                        disabled={riaprendo === p.id}
                        className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-bob-indigo hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                        data-testid={`riapri-${p.id}`}
                      >
                        Riapri
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ---- 4. Appuntamento ---- */}
      {prossimo && (
        <section className="card p-5" data-testid="richiesta-appuntamento">
          <h2 className={TITOLO_SEZIONE}>Appuntamento</h2>
          <div className={`mt-3 flex ${RIGA_APPUNTAMENTO_CLIENTE}`} data-testid={`appt-${prossimo.id}`}>
            <RigaAppuntamentoCliente
              a={prossimo}
              titolo={richiesta.servizio ?? undefined}
              nomePro={nomePro(prossimo.professional_id)}
              onCambiato={() => void carica()}
            />
          </div>
          {/* La proposta del pro si accetta anche da qui: stesse tre
              risposte e stesso gestore di «Da fare ora». */}
          {propostaDaRispondere(prossimo) && (
            <div className="mt-2 flex flex-wrap gap-x-1 pl-[58px]">
              <button
                onClick={() => rispondi(prossimo, true)}
                disabled={inCorso === prossimo.id}
                className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                data-testid={`appt-confirm-${prossimo.id}`}
              >
                Conferma
              </button>
              <button
                onClick={() => setAltroOrarioPer(prossimo)}
                disabled={inCorso === prossimo.id}
                className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-bob-indigo hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                data-testid={`appt-counter-${prossimo.id}`}
              >
                Altro orario
              </button>
              <button
                onClick={() => rispondi(prossimo, false)}
                disabled={inCorso === prossimo.id}
                className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-bob-ink/65 hover:text-red-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                data-testid={`appt-decline-${prossimo.id}`}
              >
                Rifiuta
              </button>
              {erroreRisposta?.id === prossimo.id && (
                <p role="alert" className="w-full px-2 text-xs text-red-600" data-testid={`appt-errore-${prossimo.id}`}>
                  {erroreRisposta.testo}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ---- 5. Com'è andata? ---- */}
      {/* Si recensisce chi ha lavorato: gli archiviati no (15/10, PR 7). */}
      <ComEAndata
        richiesta={richiesta}
        pros={pros.filter((p) => !archiviati.has(p.id)).map((p) => ({ id: p.id, nome: p.nome }))}
        recensioni={recensioni}
        haAppuntamento={haAppuntamento}
        onCambiato={carica}
      />

      {/* ---- 6. Altro ---- */}
      <section className="card p-5">
        <h2 className={TITOLO_SEZIONE}>Altro</h2>
        <p className="mt-2 text-sm text-bob-ink/70">
          Codice della richiesta:{" "}
          <span className="font-mono font-semibold text-bob-ink" data-testid="richiesta-codice">
            {codiceBreve(richiesta.id)}
          </span>
        </p>
        {/* /supporto e' il modulo per scrivere (anche senza account); le
            risposte si rileggono in /impostazioni/assistenza. */}
        <Link
          href="/supporto"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-bob-indigo hover:underline"
        >
          Hai bisogno di aiuto? Scrivi all&apos;assistenza
        </Link>
      </section>

      {domanda && (
        <FinestraConferma
          titolo={
            domanda.tipo === "scegli"
              ? `Scegli ${domanda.pro.nome}?`
              : `Archiviare la conversazione con ${domanda.pro.nome}?`
          }
          conferma={domanda.tipo === "scegli" ? "Scegli" : "Archivia"}
          inCorso={inviando}
          errore={erroreDomanda}
          onConferma={() => void rispondiDomanda()}
          onAnnulla={() => setDomanda(null)}
          testid={`finestra-${domanda.tipo}`}
        >
          {domanda.tipo === "scegli" ? (
            (() => {
              // Quanti verranno archiviati: gli altri ancora attivi.
              const n = pros.filter((p) => p.id !== domanda.pro.id && !archiviati.has(p.id)).length;
              return n === 0 ? (
                <>Le altre conversazioni sono già archiviate.</>
              ) : (
                <>
                  {n === 1 ? "L'altra conversazione verrà archiviata" : `Le altre ${n} conversazioni verranno archiviate`}{" "}
                  e {n === 1 ? "il professionista riceverà" : "i professionisti riceveranno"}: «Il cliente ha
                  chiuso questa richiesta.»
                </>
              );
            })()
          ) : (
            <>Riceverà: «Il cliente ha chiuso questa richiesta.» Potrai riaprirla quando vuoi.</>
          )}
        </FinestraConferma>
      )}

      {altroOrarioPer && (
        <AltroOrario
          appuntamento={altroOrarioPer}
          nomePro={nomePro(altroOrarioPer.professional_id)}
          onChiudi={() => setAltroOrarioPer(null)}
          onProposto={carica}
        />
      )}
    </div>
  );
}
