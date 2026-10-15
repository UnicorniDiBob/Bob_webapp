"use client";

// Dashboard cliente v2 — organizzata per "cosa richiede attenzione",
// non per data di creazione delle richieste. Sul telefono, in quest'ordine
// (15/10; sul desktop vedi «DUE COLONNE» piu' sotto):
//   1. Da fare ora    → proposte di appuntamento, risposte non lette,
//                       lavori fatti da chiudere, lavori fermi, recensioni
//                       mancanti — in quest'ordine (lib/daFareCliente.ts, 15/10)
//   2. Prossimi appuntamenti → proposte da confermare + confermati (migration 021)
//   3. Lavori in corso → un box per richiesta aperta, che apre la sua pagina
//                       (15/10, BoxLavoro; o, se non c'e' niente di niente,
//                       «Parla con Bob»)
//   4. I tuoi professionisti → ricontatto in un tap
//   5. Storico        → richieste concluse, ripiegate

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LinkChat } from "@/components/LinkChat";
import { Bell, Calendar, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ReviewDialog } from "@/components/ReviewDialog";
import { BoxLavoro } from "@/components/BoxLavoro";
import { passiRichiesta, type StatoAppuntamento } from "@/lib/passiRichiesta";
import { rigaStatoLavoro } from "@/lib/boxLavoro";
import { chiaveCoppia, senzaArchiviati } from "@/lib/scelta";
import { AltroOrario } from "@/components/AltroOrario";
import {
  RIGA_APPUNTAMENTO_CLIENTE,
  RigaAppuntamentoCliente,
} from "@/components/RigaAppuntamentoCliente";
import {
  COLONNE_APPUNTAMENTO_CLIENTE,
  fmtDayParts,
  useRispostaAppuntamento,
  type AppuntamentoCliente,
} from "@/lib/appuntamentoCliente";
import {
  daRecensire,
  divisiDaFare,
  nonFinito,
  quandoBreve,
  riepilogoCliente,
  ultimoMessaggioPerRichiesta,
  vociDaFare,
  type AppuntamentoDaFare,
  type VoceDaFare,
} from "@/lib/daFareCliente";

interface CustomerRequest {
  id: string;
  status: string;
  /** «disdetto» = prenotazione annullata (113): non e' un lavoro fatto. */
  closed_reason: string | null;
  problem_description: string | null;
  created_at: string | null;
  service: { name: string } | null;
  city: { name: string } | null;
  /**
   * I pro della richiesta che CONTANO: gli archiviati (120) sono fuori, cosi'
   * non entrano ne' nelle risposte, ne' nei non letti, ne' nelle recensioni.
   */
  pros: { id: string; name: string }[];
  /** Il pro scelto (120), se non e' stato archiviato dopo. */
  scelto: string | null;
}

type Appointment = AppuntamentoCliente;

const OPEN_STATUSES = ["sent", "quote_request", "matched"];

function fmtDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** Sotto lg gli appuntamenti si fermano a due, poi «Vedi tutti (N)» (15/10). */
const APPUNTAMENTI_SUL_TELEFONO = 2;

/** La classe di una riga di «Da fare ora» che e' tutta un tasto: 44px, fuoco visibile. */
const RIGA_TASTO =
  "flex min-h-[44px] w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl bg-white px-3.5 py-2.5 text-left shadow-sm transition hover:bg-bob-indigo-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40";

export function CustomerHome({
  onRiepilogo,
}: {
  /** Il sottotitolo sotto «Ciao <nome>»: lo scrive la pagina (15/10). */
  onRiepilogo?: (testo: string) => void;
} = {}) {
  const supabase = createClient();
  const { user } = useAuth();

  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [unreadByReq, setUnreadByReq] = useState<Map<string, number>>(new Map());
  // (022) non letti per singolo thread richiesta:pro (confronto preventivi)
  const [unreadByPair, setUnreadByPair] = useState<Map<string, number>>(
    new Map()
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // Tutti gli appuntamenti delle richieste aperte, di ogni stato e data:
  // «lavoro-fatto» e la vecchia «chiusura» (15/10, PR 6). Quelli qui sopra
  // sono solo i prossimi, per «Prossimi appuntamenti».
  const [appuntamentiAperte, setAppuntamentiAperte] = useState<AppuntamentoDaFare[]>([]);
  // Chi ha risposto davvero, per richiesta aperta: gli id dei pro che hanno
  // scritto almeno un messaggio (15/10, con la migrazione 119). I non letti
  // qui sopra non bastano: un pro gia' letto ha risposto lo stesso.
  const [rispondenti, setRispondenti] = useState<Map<string, Set<string>>>(new Map());
  // L'orologio di «È andato tutto bene?» (PR 9, 15/10): l'ultimo messaggio
  // vero per richiesta, nelle conversazioni non archiviate.
  const [ultimoMessaggio, setUltimoMessaggio] = useState<Map<string, string>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [reviewFor, setReviewFor] = useState<CustomerRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [tuttiDaFare, setTuttiDaFare] = useState(false);
  const [tuttiAppuntamenti, setTuttiAppuntamenti] = useState(false);
  // Contro-proposta: slot liberi del pro (mai il suo calendario completo).
  const [slotPickerFor, setSlotPickerFor] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("requests")
      .select(
        "id, status, closed_reason, problem_description, created_at, chosen_professional_id, services ( name ), cities ( name ), request_professionals ( professional_id, archived_at, professionals ( id, user_id ) )"
      )
      .eq("customer_id", user.id)
      // «draft» = mai partita. Ci finiscono le richieste declassate quando la
      // consegna al professionista fallisce (RequestDialog): esistono come
      // riga, ma nessuno le ha ricevute. Fra i lavori in corso non ci vanno —
      // nell'export dei dati sì, perché restano dati della persona.
      .neq("status", "draft")
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as Record<string, unknown>[];

    // Nomi dei professionisti coinvolti.
    const proUserIds = new Set<string>();
    for (const r of rows) {
      for (const rp of (r.request_professionals ?? []) as Record<string, unknown>[]) {
        const prof = rp.professionals as { user_id?: string } | null;
        if (prof?.user_id) proUserIds.add(prof.user_id);
      }
    }
    const nameByUser = new Map<string, string>();
    if (proUserIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", Array.from(proUserIds));
      for (const p of (profs ?? []) as { user_id: string; full_name: string | null }[]) {
        if (p.full_name) nameByUser.set(p.user_id, p.full_name);
      }
    }

    // SCEGLI E ARCHIVIA (15/10, PR 7). Le coppie «richiesta:pro» archiviate:
    // quei pro escono da tutto quello che la dashboard conta.
    const archiviati = new Set<string>();
    for (const r of rows) {
      for (const rp of (r.request_professionals ?? []) as Record<string, unknown>[]) {
        if (rp.archived_at) archiviati.add(chiaveCoppia(r.id as string, rp.professional_id as string));
      }
    }

    const reqs: CustomerRequest[] = rows.map((r) => {
      const rps = ((r.request_professionals ?? []) as Record<string, unknown>[]).filter(
        (rp) => !rp.archived_at
      );
      const scelto = (r.chosen_professional_id as string | null) ?? null;
      const pros = rps
        .map((rp) => {
          const prof = rp.professionals as { id: string; user_id: string | null } | null;
          if (!prof) return null;
          return {
            id: prof.id,
            name: (prof.user_id && nameByUser.get(prof.user_id)) || "Professionista",
          };
        })
        .filter(Boolean) as { id: string; name: string }[];
      return {
        id: r.id as string,
        status: r.status as string,
        closed_reason: (r.closed_reason as string | null) ?? null,
        problem_description: (r.problem_description as string) ?? null,
        created_at: (r.created_at as string) ?? null,
        service: r.services as { name: string } | null,
        city: r.cities as { name: string } | null,
        pros,
        scelto: scelto && pros.some((p) => p.id === scelto) ? scelto : null,
      };
    });
    setRequests(reqs);

    const ids = reqs.map((r) => r.id);
    if (ids.length) {
      // Non letti per conversazione (risposte dei pro).
      const { data: unreadRows } = await supabase
        .from("request_messages")
        .select("request_id, professional_id")
        .in("request_id", ids)
        .eq("sender_type", "professional")
        .is("read_at", null);
      const m = new Map<string, number>();
      const mp = new Map<string, number>();
      for (const u of senzaArchiviati(
        (unreadRows ?? []) as { request_id: string; professional_id: string | null }[],
        archiviati
      )) {
        m.set(u.request_id, (m.get(u.request_id) ?? 0) + 1);
        const k = `${u.request_id}:${u.professional_id ?? ""}`;
        mp.set(k, (mp.get(k) ?? 0) + 1);
      }
      setUnreadByReq(m);
      setUnreadByPair(mp);

      // Appuntamenti futuri (proposti o confermati) sulle mie richieste.
      const { data: appts } = await supabase
        .from("appointments")
        .select(COLONNE_APPUNTAMENTO_CLIENTE)
        .in("request_id", ids)
        .in("status", ["proposed", "confirmed"])
        .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order("starts_at", { ascending: true })
        .limit(6);
      setAppointments(senzaArchiviati((appts as Appointment[]) ?? [], archiviati));

      // Gli appuntamenti delle richieste aperte, senza limiti di data: un
      // lavoro finito la settimana scorsa e' ancora da chiudere (15/10).
      const aperteIds = reqs.filter((r) => OPEN_STATUSES.includes(r.status)).map((r) => r.id);
      if (aperteIds.length) {
        const { data: storia } = await supabase
          .from("appointments")
          .select("id, request_id, professional_id, status, starts_at, duration_minutes, proposed_by")
          .in("request_id", aperteIds);
        setAppuntamentiAperte(senzaArchiviati((storia as AppuntamentoDaFare[]) ?? [], archiviati));

        // Solo gli id, mai il testo dei messaggi: serve sapere chi ha
        // scritto, non cosa.
        // (PR 9, 15/10) La stessa lettura serve anche all'orologio di «È
        // andato tutto bene?»: messaggi del cliente e dei pro, con l'ora.
        // Sempre solo id e date, mai il testo.
        const { data: scritti } = await supabase
          .from("request_messages")
          .select("request_id, professional_id, sender_type, created_at")
          .in("request_id", aperteIds)
          .in("sender_type", ["customer", "professional"]);
        const righe = (scritti ?? []) as {
          request_id: string;
          professional_id: string | null;
          sender_type: string;
          created_at: string;
        }[];
        setUltimoMessaggio(ultimoMessaggioPerRichiesta(righe, archiviati));
        const chi = new Map<string, Set<string>>();
        for (const m of senzaArchiviati(righe, archiviati)) {
          if (m.sender_type !== "professional" || !m.professional_id) continue;
          if (!chi.has(m.request_id)) chi.set(m.request_id, new Set());
          chi.get(m.request_id)!.add(m.professional_id);
        }
        setRispondenti(chi);
      } else {
        setAppuntamentiAperte([]);
        setRispondenti(new Map());
        setUltimoMessaggio(new Map());
      }

      const { data: myRatings } = await supabase
        .from("ratings")
        .select("request_id, professional_id")
        .eq("customer_id", user.id);
      setReviewed(
        new Set(
          ((myRatings ?? []) as { request_id: string | null; professional_id: string }[])
            .filter((x) => x.request_id)
            .map((x) => `${x.request_id}:${x.professional_id}`)
        )
      );
    } else {
      setUnreadByReq(new Map());
      setAppointments([]);
      setAppuntamentiAperte([]);
      setRispondenti(new Map());
      setUltimoMessaggio(new Map());
    }
    setLoadingData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Conferma / Rifiuta: la stessa risposta della pagina della richiesta
  // (lib/appuntamentoCliente.ts, 15/10).
  const { rispondi: respondToAppointment, inCorso: respondingAppt } =
    useRispostaAppuntamento(user?.id, load);

  function openSlotPicker(a: Appointment) {
    setSlotPickerFor(a);
  }

  const proName = (professionalId: string) => {
    for (const r of requests) {
      const p = r.pros.find((x) => x.id === professionalId);
      if (p) return p.name;
    }
    return "Professionista";
  };
  const requestById = (id: string | null) => requests.find((r) => r.id === id);

  const openRequests = requests.filter((r) => OPEN_STATUSES.includes(r.status));
  const closedRequests = requests.filter((r) => r.status === "closed");
  // Una prenotazione disdetta non si recensisce: non e' un lavoro fatto, e la
  // policy delle recensioni la rifiuta comunque (113). La regola sta in
  // lib/daFareCliente.ts, la stessa per «Da fare ora» e per lo storico.
  const prossimi = appointments.filter((a) => nonFinito(a));
  const apptByRequest = new Map<string | null, StatoAppuntamento>();
  for (const a of appointments) {
    if (a.status === "confirmed") apptByRequest.set(a.request_id, "confermato");
    else if (a.status === "proposed" && !apptByRequest.has(a.request_id))
      apptByRequest.set(a.request_id, "da-confermare");
  }

  // ---- Da fare ora ----
  // Cosa c'e' e in che ordine lo decide lib/daFareCliente.ts (15/10): qui
  // c'e' solo come si disegna ogni riga.
  const daFare = vociDaFare({
    appuntamenti: appointments,
    appuntamentiAperte,
    aperte: openRequests,
    chiuse: closedRequests,
    nonLettiPerCoppia: unreadByPair,
    nonLettiPerRichiesta: unreadByReq,
    recensite: reviewed,
    ultimoMessaggio,
  });
  const { visibili, nascoste } = divisiDaFare(daFare);
  const righeDaFare = tuttiDaFare ? daFare : visibili;
  const riepilogo = riepilogoCliente(daFare.length, appointments);

  useEffect(() => {
    if (!loadingData) onRiepilogo?.(riepilogo);
  }, [loadingData, riepilogo, onRiepilogo]);

  function testoRiga(testo: string, sotto: string) {
    return (
      <span className="min-w-0 text-sm">
        <span className="font-semibold text-bob-ink">{testo}</span>
        <span className="text-bob-ink/70"> · {sotto}</span>
      </span>
    );
  }

  function rigaDaFare(v: VoceDaFare<Appointment, CustomerRequest>) {
    switch (v.tipo) {
      case "proposta": {
        const a = v.appuntamento;
        const { dow, day, time } = fmtDayParts(a.starts_at);
        // Tre risposte, tre tasti: qui la riga non puo' essere un tasto
        // solo. Ognuno ha la sua area di 44px.
        return (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl bg-white px-3.5 py-1.5 shadow-sm">
            {testoRiga(
              `${proName(a.professional_id)} propone un appuntamento`,
              `${dow} ${day} alle ${time}${a.title ? ` · ${a.title}` : ""}`
            )}
            <span className="-mx-2 flex shrink-0 flex-wrap">
              <button
                onClick={() => respondToAppointment(a, true)}
                disabled={respondingAppt === a.id}
                className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                data-testid={`appt-confirm-${a.id}`}
              >
                Conferma
              </button>
              <button
                onClick={() => openSlotPicker(a)}
                disabled={respondingAppt === a.id}
                className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-bob-indigo hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                data-testid={`appt-counter-${a.id}`}
              >
                Altro orario
              </button>
              <button
                onClick={() => respondToAppointment(a, false)}
                disabled={respondingAppt === a.id}
                className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-bob-ink/65 hover:text-red-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                data-testid={`appt-decline-${a.id}`}
              >
                Rifiuta
              </button>
            </span>
          </div>
        );
      }
      // Le righe con un'azione sola sono tutte un tasto (15/10): a 390px
      // «Rispondi →» era alto 22px, e il dito prende la riga, non la scritta.
      case "risposta": {
        const r = v.richiesta;
        return (
          <LinkChat
            href={`/messaggi?r=${r.id}&p=${v.pro.id}`}
            className={RIGA_TASTO}
            data-testid={`todo-${v.chiave}`}
          >
            {testoRiga(
              `${v.pro.name} ti ha risposto`,
              `${r.service?.name ?? "Richiesta"}${
                v.messaggi > 1 ? ` · ${v.messaggi} messaggi` : ""
              }`
            )}
            <span className="shrink-0 text-sm font-semibold text-bob-indigo">
              Rispondi →
            </span>
          </LinkChat>
        );
      }
      // CHIUDERE SI FA NELLA PAGINA DELLA RICHIESTA (15/10, PR 6). Le due
      // righe portano a «Com'è andata?» (#com-e-andata), dove «Sì, è
      // concluso» e le stelle stanno insieme: qui c'era una finestra di
      // conferma che chiudeva alla cieca, senza vedere con chi e come.
      case "lavoro-fatto": {
        const r = v.richiesta;
        return (
          <Link
            href={`/dashboard/richieste/${r.id}#com-e-andata`}
            className={RIGA_TASTO}
            data-testid={`todo-${v.chiave}`}
          >
            {testoRiga(
              `Com'è andato il lavoro con ${v.pro.name}?`,
              `${r.service?.name ?? "Lavoro"} · ${quandoBreve(v.inizio)}`
            )}
            <span className="shrink-0 text-sm font-semibold text-bob-indigo">
              Chiudi e recensisci →
            </span>
          </Link>
        );
      }
      case "chiusura": {
        const r = v.richiesta;
        return (
          <Link
            href={`/dashboard/richieste/${r.id}#com-e-andata`}
            className={RIGA_TASTO}
            data-testid={`todo-${v.chiave}`}
          >
            {testoRiga(
              "È andato tutto bene?",
              `${r.service?.name ?? "Richiesta"} · in corso dal ${fmtDate(r.created_at)}`
            )}
            <span className="shrink-0 text-sm font-semibold text-bob-indigo">
              Chiudi e recensisci →
            </span>
          </Link>
        );
      }
      case "recensioni": {
        const [r] = v.richieste;
        const conChi =
          r.pros.find((p) => !reviewed.has(`${r.id}:${p.id}`))?.name ??
          r.pros[0]?.name;
        return (
          <button
            type="button"
            onClick={() => setReviewFor(r)}
            className={RIGA_TASTO}
            data-testid="todo-recensioni"
          >
            {v.richieste.length === 1
              ? testoRiga(
                  `Com'è andata con ${conChi}?`,
                  // La data distingue due lavori con lo stesso pro e lo stesso
                  // servizio: senza, erano righe identiche (rilievo del 3/10).
                  `${r.service?.name ?? "Lavoro"} del ${fmtDate(r.created_at)} · la tua recensione aiuta gli altri`
                )
              : testoRiga(
                  `Hai ${v.richieste.length} lavori da recensire`,
                  `il più recente: ${r.service?.name ?? "lavoro"} con ${conChi} del ${fmtDate(r.created_at)}`
                )}
            <span className="shrink-0 text-sm font-semibold text-bob-indigo">
              ★ Recensisci →
            </span>
          </button>
        );
      }
    }
  }

  // ---- I tuoi professionisti (dedup, con conversazione più recente) ----
  const trustedPros: { id: string; name: string; requestId: string }[] = [];
  for (const r of requests) {
    for (const p of r.pros) {
      if (!trustedPros.some((t) => t.id === p.id)) {
        trustedPros.push({ id: p.id, name: p.name, requestId: r.id });
      }
    }
  }

  // ---- Disposizione (15/10) ----
  const haDaFare = daFare.length > 0;
  // Niente da fare e niente in corso: al posto dei lavori, «Parla con Bob».
  // (Chi non ha mai fatto una richiesta ha la sua pagina vuota, piu' sotto.)
  const aManiVuote = !haDaFare && openRequests.length === 0;

  // «I TUOI PROFESSIONISTI» E' UNA SCHEDA SUA (15/10). Stava dentro quella
  // degli appuntamenti, e sembrava un pezzo degli appuntamenti. Righe da
  // 44px: il nome (22px) e «Scrivi →» (18px) non si prendevano col dito.
  // `dove` e' la classe che la accende solo sul telefono o solo sul desktop
  // (vedi «DUE COLONNE» qui sotto).
  function cardProfessionisti(dove: string) {
    return (
      <section className={`card p-5 ${dove}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/70">
          I tuoi professionisti
        </h2>
        <ul className="mt-2 flex flex-col">
          {trustedPros.slice(0, 5).map((p) => (
            <li key={p.id} className="flex min-h-[44px] items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bob-indigo-50 text-2xs font-bold text-bob-indigo">
                {p.name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <Link
                href={`/professionisti/${p.id}`}
                className="flex min-h-[44px] min-w-0 flex-1 items-center rounded-lg text-sm font-medium text-bob-ink hover:text-bob-indigo focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
              >
                <span className="truncate">{p.name}</span>
              </Link>
              <LinkChat
                href={`/messaggi?r=${p.requestId}&p=${p.id}`}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-2 text-sm font-medium text-bob-indigo hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
              >
                Scrivi →
              </LinkChat>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (loadingData) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 animate-pulse bg-black/[0.03]" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bob-indigo-50 text-bob-indigo">
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="font-semibold text-bob-ink">Nessuna richiesta ancora</h3>
        <p className="max-w-sm text-sm text-bob-ink/70">
          Racconta a Bob il tuo problema: capisce di cosa hai bisogno e ti
          mette in contatto con i professionisti giusti.
        </p>
        <Link href="/#bob" className="btn-primary mt-1 px-5 py-2.5">
          Parla con Bob
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* DUE COLONNE COME IL PRO (15/10). Sul desktop la colonna principale
          (Da fare ora, Lavori in corso) e una laterale di 320px
          (appuntamenti, professionisti), le stesse proporzioni di
          ProWorkspace: le due aree personali sono sorelle, e chi passa
          dall'una all'altra ritrova le cose allo stesso posto.

          L'APPUNTAMENTO VIENE SECONDO SUL TELEFONO (15/10). Il 14/10 a
          390px «Prossimi appuntamenti» cominciava a 2455px, dopo 1600px di
          lavori in corso: per il cliente e' la seconda cosa da sapere,
          dopo cio' che aspetta una sua risposta.

          COME SI TENGONO INSIEME I DUE ORDINI. L'ordine del DOM e' quello del
          telefono, perche' e' quello che leggono il lettore di schermo e il
          Tab. Una griglia sola non basta: le righe sono condivise, e la
          colonna piu' corta in alto lascerebbe un buco sotto di se'. Cosi'
          la colonna laterale e' un blocco solo che occupa due righe
          («auto» e «1fr»: chi attraversa una riga flessibile allarga solo
          quella, e la prima resta alta quanto «Da fare ora»). Il prezzo e'
          che «I tuoi professionisti» si scrive due volte: dentro la colonna
          laterale (solo desktop) e dopo i lavori (solo telefono). La copia
          spenta e' display:none: fuori dall'albero di accessibilita' e dal
          Tab. «display: contents» con due colonne avrebbe messo i
          professionisti prima dei lavori nel DOM del telefono. */}
      <div
        className={`grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] ${
          haDaFare ? "lg:grid-rows-[auto_1fr]" : ""
        }`}
      >
        {/* ---- 1. Da fare ora ---- */}
        {daFare.length > 0 && (
          <section
            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 lg:col-start-1 lg:row-start-1"
            data-testid="todo-strip"
          >
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              Da fare ora
            </p>
            <ul className="mt-2.5 flex flex-col gap-2">
              {righeDaFare.map((v) => (
                <li key={v.chiave}>{rigaDaFare(v)}</li>
              ))}
              {nascoste.length > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => setTuttiDaFare((t) => !t)}
                    aria-expanded={tuttiDaFare}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-xl text-sm font-semibold text-amber-800 transition hover:bg-amber-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                    data-testid="todo-altri"
                  >
                    {tuttiDaFare
                      ? "Mostra meno"
                      : nascoste.length === 1
                        ? "+1 altro"
                        : `+${nascoste.length} altri`}
                  </button>
                </li>
              )}
            </ul>
          </section>
        )}

        <div
          className={`flex flex-col gap-5 self-start lg:col-start-2 lg:row-start-1 ${
            haDaFare ? "lg:row-span-2" : ""
          }`}
        >
          {/* ---- 2. Prossimi appuntamenti ---- */}
          <section className="card p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-bob-ink/70">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Prossimi appuntamenti
            </h2>
            {prossimi.length === 0 ? (
              <p className="mt-4 text-sm text-bob-ink/65">
                Nessun appuntamento in programma. Quando prenoti un servizio o un
                professionista te ne propone uno, lo trovi qui.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {prossimi.map((a, i) => (
                  <li
                    key={a.id}
                    className={`${
                      i >= APPUNTAMENTI_SUL_TELEFONO && !tuttiAppuntamenti ? "hidden lg:flex" : "flex"
                    } ${RIGA_APPUNTAMENTO_CLIENTE}`}
                    data-testid={`appt-${a.id}`}
                  >
                    <RigaAppuntamentoCliente
                      a={a}
                      titolo={requestById(a.request_id)?.service?.name}
                      nomePro={proName(a.professional_id)}
                      onCambiato={load}
                    />
                  </li>
                ))}
              </ul>
            )}
            {/* «VEDI TUTTI» SOLO SUL TELEFONO (15/10): li' gli appuntamenti
                stanno sopra i lavori in corso, e sei righe con le loro icone
                li spingerebbero di nuovo giu'. Sul desktop stanno di lato e
                si vedono tutti. */}
            {prossimi.length > APPUNTAMENTI_SUL_TELEFONO && (
              <button
                type="button"
                onClick={() => setTuttiAppuntamenti((t) => !t)}
                aria-expanded={tuttiAppuntamenti}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl text-sm font-semibold text-bob-indigo transition hover:bg-bob-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40 lg:hidden"
                data-testid="appt-vedi-tutti"
              >
                {tuttiAppuntamenti ? "Mostra meno" : `Vedi tutti (${prossimi.length})`}
              </button>
            )}
          </section>
          {trustedPros.length > 0 && cardProfessionisti("hidden lg:block")}
        </div>

        {/* ---- 3. Lavori in corso ---- */}
        {/* IL NUOVO LAVORO SI COMINCIA DA QUI, MA SOLO A MANI VUOTE (15/10).
            Quando niente aspetta il cliente e niente e' in corso, la pagina
            era un elenco di cose passate senza una porta per la prossima
            (c'era solo il bottone nell'header). Se invece c'e' qualcosa da
            fare o un lavoro aperto, l'invito ruberebbe la scena a quello. */}
        {aManiVuote ? (
          <section
            className={`card self-start p-5 lg:col-start-1 ${haDaFare ? "lg:row-start-2" : "lg:row-start-1"}`}
            data-testid="parla-con-bob"
          >
            <h2 className="text-lg font-bold text-bob-ink">Hai un nuovo problema in casa?</h2>
            <p className="mt-1 text-sm text-bob-ink/70">
              Racconta a Bob cosa ti serve: ti mette in contatto con i
              professionisti giusti.
            </p>
            <Link href="/#bob" className="btn-primary mt-4 min-h-[44px] px-5 py-2.5">
              Parla con Bob
            </Link>
          </section>
        ) : (
          <section className={`card self-start p-5 lg:col-start-1 ${haDaFare ? "lg:row-start-2" : "lg:row-start-1"}`}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/70">
              Lavori in corso
            </h2>
            {openRequests.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-bob-indigo/25 bg-bob-indigo-50/40 p-4 text-center">
                <p className="text-sm text-bob-ink/70">
                  Nessun lavoro in corso.{" "}
                  <Link href="/#bob" className="font-medium text-bob-indigo hover:underline">
                    Parla con Bob
                  </Link>{" "}
                  per iniziarne uno.
                </p>
              </div>
            ) : (
              /* UN BOX PER LAVORO, E OGNI BOX E' UN LINK SOLO (15/10). Qui
                 c'erano la barra di stato intera, «Confronta le risposte» con
                 un «Apri →» per pro e «Segna come concluso»: a 390px la
                 sezione era alta 1377px con cinque richieste. Le decisioni
                 (confrontare, scegliere, chiudere) stanno nella pagina della
                 richiesta; qui resta «a che punto e', e c'e' qualcosa di
                 nuovo?». «SEGNA COME CONCLUSO» NON STA PIU' QUI: si chiude da
                 «Com'e' andata?» nella pagina della richiesta, dove c'e' anche
                 la recensione — chiudere senza vedere con chi e com'e' andata
                 era il modo piu' facile di chiudere il lavoro sbagliato. Sul
                 desktop due box per riga, alti uguali; uno solo prende tutta
                 la larghezza. */
              <ul
                className={`mt-3 grid grid-cols-1 gap-3 ${
                  openRequests.length > 1 ? "lg:grid-cols-2" : ""
                }`}
              >
                {openRequests.map((r) => {
                  const suoi = appointments.filter((a) => a.request_id === r.id);
                  return (
                    <li key={r.id}>
                      <BoxLavoro
                        id={r.id}
                        servizio={r.service?.name ?? "Richiesta"}
                        citta={r.city?.name ?? null}
                        nonLetti={unreadByReq.get(r.id) ?? 0}
                        stato={rigaStatoLavoro({
                          status: r.status,
                          appuntamenti: suoi,
                          pros: r.pros,
                          rispondenti: rispondenti.get(r.id) ?? new Set(),
                          scelto: r.scelto,
                        })}
                        passi={passiRichiesta({
                          status: r.status,
                          closedReason: r.closed_reason,
                          appuntamento: apptByRequest.get(r.id) ?? null,
                          quoteCount: r.pros.length,
                        })}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* ---- 4. I tuoi professionisti (telefono: dopo i lavori) ---- */}
        {trustedPros.length > 0 && cardProfessionisti("lg:hidden")}

        {/* ---- 5. Storico ---- */}
        {closedRequests.length > 0 && (
          <section
            className={`card p-5 lg:col-span-2 ${haDaFare ? "lg:row-start-3" : "lg:row-start-2"}`}
          >
            <button
              onClick={() => setShowHistory((s) => !s)}
              aria-expanded={showHistory}
              className="flex min-h-[44px] w-full items-center justify-between rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
              data-testid="toggle-history"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/70">
                Storico · {closedRequests.length} richiest
                {closedRequests.length === 1 ? "a" : "e"} chius
                {closedRequests.length === 1 ? "a" : "e"}
              </h2>
              <span className="text-bob-ink/65">{showHistory ? "▲" : "▼"}</span>
            </button>
            {showHistory && (
              /* OGNI RIGA DELLO STORICO APRE LA SUA RICHIESTA (15/10). C'erano
                 «Conversazione» e «★ Recensisci»: la conversazione e la
                 recensione («Com'e' andata?») stanno nella pagina della
                 richiesta, e la riga intera e' un bersaglio solo. «★ Da
                 recensire» e' solo un'etichetta, con la regola di «Da fare
                 ora» (daRecensire). */
              <ul className="mt-2 flex flex-col divide-y divide-black/5">
                {closedRequests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/dashboard/richieste/${r.id}`}
                      className="-mx-2 flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-bob-indigo-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
                      data-testid={`storico-${r.id}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-bob-ink">
                          {r.service?.name ?? "Richiesta"}
                          {r.pros[0] ? (
                            <span className="font-normal text-bob-ink/65"> · {r.pros[0].name}</span>
                          ) : null}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-bob-ink/65">
                          <span>
                            {fmtDate(r.created_at)}
                            {r.closed_reason === "disdetto" && " · Disdetta"}
                          </span>
                          {daRecensire(r, reviewed) && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-semibold text-amber-800">
                              ★ Da recensire
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-bob-indigo">Apri →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

      </div>

      {/* ---- dialogs ---- */}
      {slotPickerFor && (
        <AltroOrario
          appuntamento={slotPickerFor}
          nomePro={proName(slotPickerFor.professional_id)}
          onChiudi={() => setSlotPickerFor(null)}
          onProposto={load}
        />
      )}

      {reviewFor && (
        <ReviewDialog
          requestId={reviewFor.id}
          professionals={reviewFor.pros.filter(
            (p) => !reviewed.has(`${reviewFor.id}:${p.id}`)
          )}
          onClose={() => setReviewFor(null)}
          onSubmitted={(proId) =>
            setReviewed((prev) => new Set([...prev, `${reviewFor.id}:${proId}`]))
          }
        />
      )}
    </div>
  );
}
