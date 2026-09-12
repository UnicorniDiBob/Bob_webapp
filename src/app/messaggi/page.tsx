"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, MessageCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useUnread } from "@/components/UnreadProvider";
import { createClient } from "@/lib/supabase/client";
import {
  busyFromAppointments,
  computeFreeSlotsWithAvailability,
  type AvailabilityWindow,
} from "@/lib/slots";
import { notifyEvent } from "@/lib/notify";
import {
  getConversations,
  getMessages,
  markConversationRead,
  sendMessage,
} from "@/lib/messages";
import type {
  Appointment,
  ChatMessage,
  ConversationSummary,
} from "@/lib/supabase/types";
import { ProCalendar } from "@/components/ProCalendar";
import {
  AppointmentActions,
  type ThreadAppointment,
} from "@/components/AppointmentActions";

function fmtTime(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("it-IT", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MessaggiPage() {
  return (
    <Suspense
      fallback={
        <div className="container-bob py-16 text-center text-sm text-bob-ink/65">
          Carico i messaggi…
        </div>
      }
    >
      <MessaggiInner />
    </Suspense>
  );
}

function MessaggiInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, role, loading } = useAuth();
  const { refresh: refreshUnread } = useUnread();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  // (022) Chiave conversazione composta "requestId::professionalId".
  // Con solo ?r= (deep link legacy) il pro viene risolto dopo il load.
  const [activeId, setActiveId] = useState<string | null>(
    params.get("r") ? `${params.get("r")}::${params.get("p") ?? ""}` : null
  );
  const activeR = activeId ? activeId.split("::")[0] : null;
  const activeP = activeId ? activeId.split("::")[1] || null : null;
  const keyOf = (c: ConversationSummary) =>
    `${c.requestId}::${c.professionalId ?? ""}`;
  // Su mobile mostriamo lista O thread: entrando con ?r= si apre subito il thread.
  const [mobileThread, setMobileThread] = useState<boolean>(
    params.get("r") != null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // (033) appuntamenti citati dai messaggi del thread, per stato aggiornato:
  // il messaggio è immutabile, la riga appointments no.
  const [threadAppts, setThreadAppts] = useState<
    Record<string, ThreadAppointment>
  >({});
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Proposta di appuntamento (solo pro): crea una riga 'proposed' in
  // appointments (migration 021) che il cliente conferma dalla dashboard.
  const [myProId, setMyProId] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("09:00");
  // DURATA LIBERA, IN DUE CAMPI (12/09, Lucio). Prima era una tendina con
  // quattro voci — 30, 60, 90, 120 — e un lavoro da venti minuti o da tre ore
  // non si poteva proporre: il pro sceglieva la voce meno sbagliata e il
  // calendario del cliente ne usciva falso. Adesso ore e minuti sono due
  // campi e la durata e' la loro somma: niente elenco da indovinare.
  const [durataOre, setDurataOre] = useState(1);
  const [durataMin, setDurataMin] = useState(0);
  const apptDuration = durataOre * 60 + durataMin;
  const [apptTitle, setApptTitle] = useState("");
  const [apptSaving, setApptSaving] = useState(false);
  const [apptErr, setApptErr] = useState<string | null>(null);
  // Se valorizzato, la nuova proposta sostituisce quella del cliente:
  // è il "Modifica" del pro (il cliente invece usa /api/appointments/counter).
  const [replacingApptId, setReplacingApptId] = useState<string | null>(null);
  // Slot rapidi: i prossimi orari liberi del pro, un tap invece di digitare.
  const [quickSlots, setQuickSlots] = useState<Date[]>([]);
  /**
   * null = non ancora letto. false = il pro non ha nessuna fascia salvata in
   * professional_availability, quindi non ci sono orari suoi da proporre e non
   * ne inventiamo (05/09).
   */
  const [orariMiei, setOrariMiei] = useState<boolean | null>(null);
  const [myBusy, setMyBusy] = useState<
    { start: number; end: number }[]
  >([]);
  /** Gli appuntamenti del pro, per farglieli vedere mentre propone. */
  const [myAppts, setMyAppts] = useState<Appointment[]>([]);
  /** Le fasce dichiarate: servono all'avviso «fuori orario», non a un blocco. */
  const [finestreOrari, setFinestreOrari] = useState<AvailabilityWindow[]>([]);

  const myType: "customer" | "professional" =
    role === "professional" ? "professional" : "customer";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Carica le conversazioni.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoadingConvs(true);
      const convs = await getConversations(user.id, role);
      if (!active) return;
      setConversations(convs);
      // Risolve la selezione: chiave esatta, poi primo thread della
      // richiesta indicata con ?r=, altrimenti la prima conversazione.
      setActiveId((cur) => {
        if (cur) {
          const [r, p] = cur.split("::");
          const exact = convs.find(
            (c) => c.requestId === r && (c.professionalId ?? "") === (p ?? "")
          );
          if (exact) return `${exact.requestId}::${exact.professionalId ?? ""}`;
          const sameReq = convs.find((c) => c.requestId === r);
          if (sameReq)
            return `${sameReq.requestId}::${sameReq.professionalId ?? ""}`;
        }
        return convs[0]
          ? `${convs[0].requestId}::${convs[0].professionalId ?? ""}`
          : null;
      });
      setLoadingConvs(false);
    })();
    return () => {
      active = false;
    };
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== "professional") return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setMyProId((data as { id: string } | null)?.id ?? null);
    })();
  }, [user, role]);

  // All'apertura del dialog carica il calendario del pro e calcola gli slot.
  //
  // GLI ORARI SUGGERITI SONO I SUOI (05/09). Prima questa scorciatoia usava
  // computeFreeSlots, cioe' la settimana inventata lun-sab 8-18: proponeva al
  // pro i «suoi prossimi orari liberi» dentro una finestra che non aveva mai
  // dichiarato, e da li' partiva una proposta al cliente. Adesso le fasce
  // arrivano da professional_availability. Se non ne ha, non si suggerisce
  // niente: il campo data e ora resta a mano e il dialog gli chiede di
  // confermare i suoi orari una volta per tutte.
  useEffect(() => {
    if (!proposeOpen || !myProId) return;
    (async () => {
      const supabase = createClient();
      const [{ data: appts }, { data: avail, error: availErr }] =
        await Promise.all([
          // Si legge la riga intera, non tre colonne: il calendario qui
          // dentro mostra nome, titolo e luogo come quello della scrivania.
          // E si parte da quattro mesi fa, se no la vista mese e la vista
          // anno sarebbero vuote proprio dove servono a decidere.
          supabase
            .from("appointments")
            .select("*")
            .eq("professional_id", myProId)
            .gte(
              "starts_at",
              new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString()
            ),
          supabase
            .from("professional_availability")
            .select("weekday, start_time, end_time")
            .eq("professional_id", myProId),
        ]);

      const rows = (appts ?? []) as Appointment[];
      setMyAppts(rows);
      const busy = busyFromAppointments(rows);
      setMyBusy(busy);

      // Una lettura fallita non e' «non hai orari»: non si accusa il pro di
      // non aver fatto una cosa che magari ha fatto. Nessun suggerimento,
      // nessun rimprovero.
      if (availErr) {
        setOrariMiei(null);
        setQuickSlots([]);
        setFinestreOrari([]);
        return;
      }

      const windows: AvailabilityWindow[] = ((avail ?? []) as {
        weekday: number;
        start_time: string;
        end_time: string;
      }[]).map((w) => ({
        weekday: w.weekday,
        start: w.start_time.slice(0, 5),
        end: w.end_time.slice(0, 5),
      }));

      setFinestreOrari(windows);
      setOrariMiei(windows.length > 0);
      setQuickSlots(
        windows.length === 0
          ? []
          : computeFreeSlotsWithAvailability({
              windows,
              busy,
              durationMinutes: apptDuration,
              stepMinutes: 60,
              days: 7,
              max: 6,
            })
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposeOpen, myProId, apptDuration]);

  function pickQuickSlot(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    setApptDate(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    );
    setApptTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setApptErr(null);
  }

  // FUORI DALLE FASCE DICHIARATE E' UN AVVISO, NON UN MURO (12/09, Lucio).
  // Le fasce in professional_availability servono a far scegliere bene il
  // cliente; non devono impedire al pro di fissare il sabato mattina che si e'
  // gia' accordato a voce. Se l'orario cade fuori glielo si dice, e si manda
  // lo stesso. Con zero fasce salvate non c'e' niente da cui essere fuori.
  const fuoriOrario = useMemo(() => {
    if (!apptDate || finestreOrari.length === 0) return false;
    const inizio = new Date(`${apptDate}T${apptTime}:00`);
    if (isNaN(inizio.getTime())) return false;
    const da = inizio.getHours() * 60 + inizio.getMinutes();
    const a = da + apptDuration;
    return !finestreOrari.some((w) => {
      if (w.weekday !== inizio.getDay()) return false;
      const [h1, m1] = w.start.split(":").map(Number);
      const [h2, m2] = w.end.split(":").map(Number);
      return da >= h1 * 60 + m1 && a <= h2 * 60 + m2;
    });
  }, [apptDate, apptTime, apptDuration, finestreOrari]);

  async function proposeAppointment() {
    if (!user || !myProId || !activeR || !apptDate || apptSaving) return;
    setApptErr(null);
    const startsAt = new Date(`${apptDate}T${apptTime}:00`);
    if (isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
      setApptErr("Scegli una data futura.");
      return;
    }
    if (apptDuration <= 0) {
      setApptErr("Metti una durata: anche solo dieci minuti, ma non zero.");
      return;
    }
    // Guardia doppia prenotazione: l'orario scelto non deve sovrapporsi
    // ai tuoi appuntamenti (confermati o in attesa).
    const s = startsAt.getTime();
    const e = s + apptDuration * 60000;
    if (myBusy.some((b) => s < b.end && e > b.start)) {
      setApptErr(
        "Hai già un appuntamento in quell'orario: scegli uno slot libero."
      );
      return;
    }
    setApptSaving(true);
    const supabase = createClient();
    const conv = conversations.find((c) => keyOf(c) === activeId);
    // "Modifica" del pro: la proposta del cliente viene rifiutata e sostituita.
    if (replacingApptId) {
      await supabase
        .from("appointments")
        .update({ status: "declined" })
        .eq("id", replacingApptId);
    }
    const { data: created, error } = await supabase
      .from("appointments")
      .insert({
        professional_id: myProId,
        request_id: activeR,
        customer_name: conv?.counterpartName ?? "Cliente",
        title: apptTitle.trim() || conv?.serviceName || null,
        starts_at: startsAt.toISOString(),
        duration_minutes: apptDuration,
        status: "proposed",
      })
      .select("id")
      .single();
    if (error || !created) {
      setApptErr("Non sono riuscito a salvare la proposta. Riprova.");
      setApptSaving(false);
      return;
    }
    const when = startsAt.toLocaleString("it-IT", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    await sendMessage(
      activeR,
      myProId,
      user.id,
      "professional",
      `Ti propongo un appuntamento: ${when} (${apptDuration} min).`,
      {
        kind: "appointment_proposal",
        appointmentId: (created as { id: string }).id,
      }
    );
    notifyEvent("appointment_proposed", {
      requestId: activeR,
      professionalId: myProId,
      preview: `${when} (${apptDuration} min)`,
    });
    await loadThread(activeR, activeP);
    setApptSaving(false);
    setProposeOpen(false);
    setReplacingApptId(null);
    setApptDate("");
    setApptTitle("");
  }

  const loadThread = useCallback(
    async (rid: string, pid: string | null) => {
      setLoadingMsgs(true);
      const m = await getMessages(rid, pid);
      setMessages(m);
      // Carica gli appuntamenti collegati alle proposte presenti nel thread.
      const ids = Array.from(
        new Set(
          m
            .filter((x) => x.kind === "appointment_proposal" && x.appointmentId)
            .map((x) => x.appointmentId as string)
        )
      );
      if (ids.length > 0) {
        const supabase = createClient();
        const { data } = await supabase
          .from("appointments")
          .select(
            "id, professional_id, request_id, starts_at, duration_minutes, status, proposed_by, title"
          )
          .in("id", ids);
        const map: Record<string, ThreadAppointment> = {};
        for (const row of (data ?? []) as ThreadAppointment[]) map[row.id] = row;
        setThreadAppts(map);
      } else {
        setThreadAppts({});
      }
      setLoadingMsgs(false);
    },
    []
  );

  // Cambio conversazione esplicito: sincronizza anche l'URL, così
  // refresh e tasto indietro non perdono la selezione.
  function selectConversation(c: ConversationSummary) {
    setActiveId(keyOf(c));
    setMobileThread(true);
    router.replace(
      `/messaggi?r=${c.requestId}${
        c.professionalId ? `&p=${c.professionalId}` : ""
      }`,
      { scroll: false }
    );
  }

  // Realtime: la risposta della controparte compare nel thread aperto
  // senza ricaricare (prima serviva riaprire la conversazione).
  // Richiede request_messages nella publication supabase_realtime (migration 019).
  useEffect(() => {
    if (!activeR || !user) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`thread-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "request_messages",
          filter: `request_id=eq.${activeR}`,
        },
        (payload) => {
          const row = payload.new as {
            sender_type?: string;
            professional_id?: string | null;
            message?: string;
            created_at?: string;
          };
          // I miei messaggi sono già mostrati con l'update ottimistico.
          if (row.sender_type === myType) return;
          // (022) reagisce solo ai messaggi del thread aperto.
          if (activeP && row.professional_id && row.professional_id !== activeP)
            return;
          loadThread(activeR, activeP);
          markConversationRead(activeR, activeP, myType).then(() =>
            refreshUnread()
          );
          setConversations((cs) =>
            cs.map((c) =>
              keyOf(c) === activeId
                ? {
                    ...c,
                    lastMessage: row.message ?? c.lastMessage,
                    lastAt: row.created_at ?? c.lastAt,
                  }
                : c
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user, myType, loadThread, refreshUnread]);

  useEffect(() => {
    if (!activeR) return;
    loadThread(activeR, activeP);
    // segna come letti i messaggi ricevuti in questo thread
    (async () => {
      await markConversationRead(activeR, activeP, myType);
      await refreshUnread();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, loadThread, myType, refreshUnread]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || !user || !activeR || sending) return;
    setSending(true);
    setDraft("");
    // ottimistico
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      senderType: myType,
      message: text,
      createdAt: new Date().toISOString(),
      kind: "text",
      appointmentId: null,
    };
    setMessages((m) => [...m, optimistic]);

    const { error } = await sendMessage(
      activeR,
      activeP ?? (myType === "professional" ? myProId : null),
      user.id,
      myType,
      text
    );
    if (error) {
      // ripristina in caso di errore
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(text);
    } else {
      notifyEvent("new_message", {
        requestId: activeR,
        professionalId:
          activeP ?? (myType === "professional" ? myProId : null),
        preview: text,
      });
      await loadThread(activeR, activeP);
      // aggiorna anteprima nella lista
      setConversations((cs) =>
        cs.map((c) =>
          keyOf(c) === activeId
            ? { ...c, lastMessage: text, lastAt: new Date().toISOString() }
            : c
        )
      );
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/65">
        Carico i messaggi…
      </div>
    );
  }

  const active = conversations.find((c) => keyOf(c) === activeId) ?? null;

  return (
    <div className="container-bob py-8">
      <header className="mb-5">
        <span className="section-eyebrow">Messaggi</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink">
          Le tue conversazioni
        </h1>
        <p className="mt-1 text-sm text-bob-ink/70">
          {myType === "professional"
            ? "Rispondi ai clienti che ti hanno contattato."
            : "Continua a parlare con i professionisti che hai contattato."}
        </p>
      </header>

      {loadingConvs ? (
        <div className="card h-64 animate-pulse bg-black/[0.03]" />
      ) : conversations.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bob-indigo-50 text-bob-indigo">
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="font-semibold text-bob-ink">Nessuna conversazione</h3>
          <p className="max-w-sm text-sm text-bob-ink/70">
            {myType === "professional"
              ? "Quando un cliente ti contatta, la conversazione comparirà qui."
              : "Parla con Bob per trovare un professionista e iniziare una conversazione."}
          </p>
          {myType !== "professional" && (
            <Link href="/#bob" className="btn-primary mt-1 px-5 py-2.5">
              Parla con Bob
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
          {/* lista conversazioni (su mobile nascosta quando un thread è aperto) */}
          <aside
            className={`card max-h-[600px] divide-y divide-black/5 overflow-y-auto p-0 ${
              mobileThread ? "hidden md:block" : ""
            }`}
          >
            {conversations.map((c) => {
              const isActive = keyOf(c) === activeId;
              return (
                <button
                  key={keyOf(c)}
                  onClick={() => selectConversation(c)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition ${
                    isActive ? "bg-bob-indigo-50" : "hover:bg-black/[0.02]"
                  }`}
                  data-testid={`conv-${c.requestId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-bob-ink">
                      {c.counterpartName}
                    </span>
                    <span className="shrink-0 text-2xs text-bob-ink/65">
                      {fmtTime(c.lastAt).split(",")[0]}
                    </span>
                  </div>
                  <span className="truncate text-xs text-bob-indigo">
                    {c.serviceName}
                    {c.cityName ? ` · ${c.cityName}` : ""}
                  </span>
                  {c.lastMessage && (
                    <span className="truncate text-xs text-bob-ink/70">
                      {c.lastMessage}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* thread (su mobile visibile solo quando aperto; altezza legata al viewport così l'input resta in vista) */}
          <section
            className={`card h-[calc(100dvh-16rem)] max-h-[600px] min-h-[320px] flex-col p-0 md:h-auto md:min-h-[400px] ${
              mobileThread ? "flex" : "hidden md:flex"
            }`}
          >
            {active ? (
              <>
                <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3.5 sm:px-5">
                  <button
                    onClick={() => setMobileThread(false)}
                    className="shrink-0 rounded-lg p-1.5 text-bob-ink/70 hover:bg-black/[0.04] hover:text-bob-indigo md:hidden"
                    aria-label="Torna alle conversazioni"
                    data-testid="button-back-to-list"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-bob-ink">
                      {active.counterpartName}
                    </p>
                    <p className="truncate text-xs text-bob-ink/70">
                      {active.serviceName}
                      {active.cityName ? ` · ${active.cityName}` : ""}
                    </p>
                  </div>
                  {myType === "professional" && myProId && (
                    <button
                      onClick={() => setProposeOpen(true)}
                      className="btn-secondary ml-auto inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs"
                      data-testid="button-propose-appointment"
                    >
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      Proponi appuntamento
                    </button>
                  )}
                </div>

                <div
                  ref={threadRef}
                  className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4"
                >
                  {loadingMsgs ? (
                    <p className="text-center text-sm text-bob-ink/65">Carico…</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-bob-ink/65">
                      Nessun messaggio ancora. Scrivi il primo.
                    </p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderType === myType;
                      // (033) proposta di appuntamento: sotto la bolla
                      // compaiono approva / modifica / rifiuta.
                      const appt =
                        m.kind === "appointment_proposal" && m.appointmentId
                          ? threadAppts[m.appointmentId]
                          : undefined;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            mine ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] lg:max-w-[42rem] rounded-2xl px-4 py-2.5 text-sm ${
                              mine
                                ? "rounded-br-sm bg-bob-indigo text-white"
                                : "rounded-bl-sm bg-bob-indigo-50 text-bob-ink"
                            }`}
                          >
                            <p className="whitespace-pre-line">{m.message}</p>
                            <p
                              className={`mt-1 text-2xs ${
                                mine ? "text-white/60" : "text-bob-ink/65"
                              }`}
                            >
                              {fmtTime(m.createdAt)}
                            </p>
                          </div>
                          {appt && user && (
                            <div className="max-w-[80%] lg:max-w-[42rem]">
                              <AppointmentActions
                                appointment={appt}
                                viewer={myType}
                                userId={user.id}
                                professionalId={
                                  activeP ??
                                  (myType === "professional" ? myProId : null)
                                }
                                counterpartName={
                                  active?.counterpartName ?? "il professionista"
                                }
                                onChanged={() =>
                                  loadThread(activeR as string, activeP)
                                }
                                onProModify={(id) => {
                                  setReplacingApptId(id);
                                  setProposeOpen(true);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex gap-2 border-t border-black/5 px-4 py-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !sending && handleSend()
                    }
                    placeholder="Scrivi un messaggio…"
                    className="input-bob py-2.5"
                    data-testid="input-message"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="btn-primary py-2.5"
                    data-testid="button-send-message"
                  >
                    Invia
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-bob-ink/65">
                Seleziona una conversazione
              </div>
            )}
          </section>
        </div>
      )}

      {proposeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setProposeOpen(false);
            setReplacingApptId(null);
          }}
        >
          <div
            className="card flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            data-testid="dialog-propose-appointment"
          >
            <div className="shrink-0 border-b border-black/5 px-5 py-4 sm:px-6">
              <h3 className="text-lg font-bold text-bob-ink">
                {replacingApptId
                  ? "Proponi un altro orario"
                  : "Proponi un appuntamento"}
              </h3>
              {replacingApptId && (
                <p className="mt-1 text-sm text-bob-ink/70">
                  La proposta del cliente viene rifiutata e sostituita da questa.
                </p>
              )}
              <p className="mt-1 text-sm text-bob-ink/70">
                Il cliente riceve la proposta in chat e la conferma dalla sua
                area personale.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1 sm:px-6">
            {orariMiei === false && (
              <div
                className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
                data-testid="propose-orari-mancanti"
              >
                Non hai ancora confermato i tuoi orari, quindi qui non ti
                suggerisco niente: scrivi data e ora a mano, oppure{" "}
                <Link
                  href="/impostazioni/orari"
                  className="font-semibold underline underline-offset-2"
                >
                  confermali una volta per tutte
                </Link>{" "}
                — da lì in poi te li propongo io, e i clienti vedono i tuoi
                orari veri invece di doverti scrivere.
              </div>
            )}
            {quickSlots.length > 0 && (
              <div className="mt-4">
                <p className="label-bob">I tuoi prossimi orari liberi</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {quickSlots.map((d) => {
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const sel =
                      apptDate ===
                        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
                          d.getDate()
                        )}` && apptTime === `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => pickQuickSlot(d)}
                        className={`chip ${
                          sel
                            ? "bg-bob-indigo text-white"
                            : "hover:bg-bob-indigo-100"
                        }`}
                        data-testid={`quick-slot-${d.toISOString()}`}
                      >
                        {d.toLocaleString("it-IT", {
                          weekday: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* IL CALENDARIO VERO, ANCHE QUI (12/09, Lucio). Fissare un
                appuntamento scrivendo una data in due campi, senza vedere la
                propria settimana, vuol dire decidere al buio: la domanda
                «quel giorno a quell'ora sono libero?» e' l'unica che conta e
                era l'unica che mancava. Adesso si clicca lo spazio vuoto e i
                campi qui sotto si riempiono da soli; chi preferisce scrivere,
                scrive. */}
            <div className="mt-4">
              <p className="label-bob">Il tuo calendario</p>
              <div className="rounded-xl border border-black/[0.07] p-2 sm:p-3">
                <ProCalendar
                  appointments={myAppts}
                  loading={false}
                  onCreateAt={(start) => pickQuickSlot(start)}
                  onSelect={() => {}}
                  selectedId={null}
                />
              </div>
              <p
                className="mt-1.5 text-xs text-bob-ink/65"
                data-testid="propose-slot-scelto"
              >
                {apptDate
                  ? `Scelto: ${new Date(
                      `${apptDate}T${apptTime}:00`
                    ).toLocaleString("it-IT", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Clicca uno spazio libero nel calendario, oppure scrivi data e ora qui sotto."}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="label-bob" htmlFor="appt-date">Data</label>
                <input
                  id="appt-date"
                  type="date"
                  value={apptDate}
                  onChange={(e) => setApptDate(e.target.value)}
                  className="input-bob mt-1.5"
                  data-testid="input-appt-date"
                />
              </div>
              <div className="min-w-0">
                <label className="label-bob" htmlFor="appt-time">Ora</label>
                <input
                  id="appt-time"
                  type="time"
                  value={apptTime}
                  onChange={(e) => setApptTime(e.target.value)}
                  className="input-bob mt-1.5"
                  data-testid="input-appt-time"
                />
              </div>
              <div className="min-w-0">
                <span className="label-bob">Durata</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="appt-ore"
                    type="number"
                    min={0}
                    max={24}
                    inputMode="numeric"
                    value={durataOre}
                    onChange={(e) =>
                      setDurataOre(
                        Math.max(0, Math.min(24, Number(e.target.value) || 0))
                      )
                    }
                    className="input-bob min-w-0 flex-1 px-2 text-center"
                    aria-label="Durata: ore"
                    data-testid="input-appt-ore"
                  />
                  <label
                    htmlFor="appt-ore"
                    className="shrink-0 text-xs text-bob-ink/65"
                  >
                    ore
                  </label>
                  <input
                    id="appt-minuti"
                    type="number"
                    min={0}
                    max={59}
                    step={5}
                    inputMode="numeric"
                    value={durataMin}
                    onChange={(e) =>
                      setDurataMin(
                        Math.max(0, Math.min(59, Number(e.target.value) || 0))
                      )
                    }
                    className="input-bob min-w-0 flex-1 px-2 text-center"
                    aria-label="Durata: minuti"
                    data-testid="input-appt-minuti"
                  />
                  <label
                    htmlFor="appt-minuti"
                    className="shrink-0 text-xs text-bob-ink/65"
                  >
                    min
                  </label>
                </div>
              </div>
              <div className="min-w-0">
                <label className="label-bob" htmlFor="appt-title">Titolo (opzionale)</label>
                <input
                  id="appt-title"
                  value={apptTitle}
                  onChange={(e) => setApptTitle(e.target.value)}
                  placeholder="Es. sopralluogo"
                  className="input-bob mt-1.5"
                />
              </div>
            </div>
            {fuoriOrario && (
              <div
                className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
                data-testid="propose-fuori-orario"
              >
                Questo orario cade fuori dalle fasce che hai dichiarato. Puoi
                proporlo lo stesso — decidi tu — ma il cliente non lo troverà
                mai fra gli orari che gli mostriamo da solo.
              </div>
            )}
            {apptErr && <p className="mt-2 text-xs text-red-600">{apptErr}</p>}
            </div>

            <div className="flex shrink-0 gap-2 border-t border-black/5 px-5 py-4 sm:px-6">
              <button
                onClick={() => setProposeOpen(false)}
                className="btn-secondary flex-1 py-2.5"
              >
                Annulla
              </button>
              <button
                onClick={proposeAppointment}
                disabled={apptSaving || !apptDate || apptDuration <= 0}
                className="btn-primary flex-1 py-2.5"
                data-testid="button-appt-send"
              >
                {apptSaving ? "Invio…" : "Invia proposta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
