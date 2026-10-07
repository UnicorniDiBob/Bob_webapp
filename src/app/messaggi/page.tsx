"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, MessageCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useUnread } from "@/components/UnreadProvider";
import { createClient } from "@/lib/supabase/client";
import {
  chatMontata,
  puntoDelTocco,
  transizioneNellaPagina,
  usaRipiego,
} from "@/lib/aperturaChat";
import {
  busyFromAppointments,
  computeFreeSlotsWithAvailability,
  conChiSiSovrappone,
  type AvailabilityWindow,
} from "@/lib/slots";
import { notifyEvent } from "@/lib/notify";
import {
  ERRORE_SOVRAPPOSIZIONE,
  TESTO_SOVRAPPOSIZIONE,
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
  AvvisoSovrapposizione,
  useAvvisoSovrapposizione,
} from "@/components/AvvisoSovrapposizione";
import {
  BigliettoAppuntamento,
  durataLeggibile,
  prezzoLeggibile,
} from "@/components/BigliettoAppuntamento";
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
  // Chi ha toccato «Apri la chat» altrove aspetta che la pagina ci sia per
  // far partire il cerchio (lib/aperturaChat.ts): montata, non caricata.
  useLayoutEffect(() => {
    chatMontata();
  }, []);
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
  // IL PREZZO STA NEL BIGLIETTO (01/10, Lucio). Vuoto = «da concordare»: non
  // tutti i lavori hanno un prezzo prima del sopralluogo, e un numero
  // inventato per riempire il campo sarebbe peggio di nessun numero.
  const [apptPrezzo, setApptPrezzo] = useState("");
  const [apptNote, setApptNote] = useState("");
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

  /** Il prezzo scritto, in euro; null se vuoto, NaN se non e' un numero. */
  const prezzoNum = useMemo(() => {
    const t = apptPrezzo.trim().replace(",", ".");
    if (!t) return null;
    const n = Number(t);
    return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
  }, [apptPrezzo]);

  const inizioScelto = useMemo(
    () => (apptDate ? new Date(`${apptDate}T${apptTime}:00`) : null),
    [apptDate, apptTime]
  );
  // CON CHI SI SOVRAPPONE (116). Prima una proposta sopra un altro impegno
  // non partiva: «spostalo». Al pro la sovrapposizione e' permessa (e' lui a
  // sapere se ci sta), quindi e' un avviso con i nomi, superato da un
  // secondo clic, e spegnibile per sempre. Senza la proposta che si sta
  // sostituendo: spostarla di mezz'ora non e' una sovrapposizione con se
  // stessa.
  const conflitti = useMemo(
    () =>
      inizioScelto
        ? conChiSiSovrappone(inizioScelto, apptDuration, myAppts, replacingApptId)
        : [],
    [inizioScelto, apptDuration, myAppts, replacingApptId]
  );
  const conflitto = conflitti.length > 0;
  const avvisoSovrapposizione = useAvvisoSovrapposizione(myProId);
  const [sovrapposizioneVista, setSovrapposizioneVista] = useState(false);
  useEffect(() => {
    setSovrapposizioneVista(false);
  }, [apptDate, apptTime, apptDuration]);

  // UN APPUNTAMENTO, UN BIGLIETTO (05/10). Ogni biglietto legge lo stato VIVO
  // dell'appuntamento: prenota -> sposta -> disdici lasciava tre biglietti
  // «Appuntamento annullato» per un solo appuntamento, e i primi due
  // mentivano su com'era andata in quel momento. Il biglietto vivo sta
  // sull'ultimo messaggio che cita l'appuntamento; i precedenti tornano la
  // frase che erano («Ho prenotato…», «Ho spostato… da… a…»), che racconta
  // lo stato di allora. Lo storico completo e' in appointment_events (113).
  const ultimoMessaggioPerAppuntamento = useMemo(() => {
    const ultimo = new Map<string, string>();
    for (const m of messages) {
      if (m.kind === "appointment_proposal" && m.appointmentId) {
        ultimo.set(m.appointmentId, m.id);
      }
    }
    return ultimo;
  }, [messages]);

  function chiudiProposta() {
    setProposeOpen(false);
    setReplacingApptId(null);
  }

  // Il «Modifica» del pro parte dal biglietto che c'era: stessa durata, stesso
  // lavoro, stesso prezzo. Si cambia l'orario, non si riscrive tutto.
  function apriModifica(id: string) {
    const v = threadAppts[id];
    if (v) {
      setDurataOre(Math.floor(v.duration_minutes / 60));
      setDurataMin(v.duration_minutes % 60);
      setApptTitle(v.title ?? "");
      setApptPrezzo(v.price != null ? String(v.price).replace(".", ",") : "");
      setApptNote(v.notes ?? "");
      pickQuickSlot(new Date(v.starts_at));
    }
    setReplacingApptId(id);
    setProposeOpen(true);
  }

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
    if (Number.isNaN(prezzoNum)) {
      setApptErr("Il prezzo dev'essere un numero, per esempio 80 o 75,50.");
      return;
    }
    // Sopra un altro impegno: la prima volta si avvisa, la seconda parte.
    if (conflitto && avvisoSovrapposizione.mostra && !sovrapposizioneVista) {
      setSovrapposizioneVista(true);
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
        price: prezzoNum,
        notes: apptNote.trim() || null,
        status: "proposed",
      })
      .select("id")
      .single();
    if (error || !created) {
      setApptErr(
        error?.code === ERRORE_SOVRAPPOSIZIONE
          ? TESTO_SOVRAPPOSIZIONE
          : "Non sono riuscito a salvare la proposta. Riprova."
      );
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
    // Il testo resta: e' quello che finisce nell'anteprima della lista, nelle
    // notifiche e nell'export. In chat al suo posto si vede il biglietto.
    const riassunto = `${when} (${durataLeggibile(apptDuration)})${
      prezzoNum != null ? ` · ${prezzoLeggibile(prezzoNum)}` : ""
    }`;
    await sendMessage(
      activeR,
      myProId,
      user.id,
      "professional",
      `Ti propongo un appuntamento: ${riassunto}.`,
      {
        kind: "appointment_proposal",
        appointmentId: (created as { id: string }).id,
      }
    );
    notifyEvent("appointment_proposed", {
      requestId: activeR,
      professionalId: myProId,
      preview: riassunto,
    });
    await loadThread(activeR, activeP);
    setApptSaving(false);
    setProposeOpen(false);
    setReplacingApptId(null);
    setApptDate("");
    setApptTitle("");
    setApptPrezzo("");
    setApptNote("");
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
            "id, professional_id, request_id, starts_at, duration_minutes, status, proposed_by, title, price, notes, location_address, location_city, location_notes, cancellation_window_hours"
          )
          .in("id", ids);
        const map: Record<string, ThreadAppointment> = {};
        for (const row of (data ?? []) as ThreadAppointment[]) map[row.id] = row;
        // Uno spostamento chiesto dal cliente e ancora da confermare (115):
        // l'orario di prima e' nello storico, nello «spostato» del cliente
        // che ha portato l'appuntamento all'orario attuale. Il biglietto lo
        // mostra, e il pro sa che dire no non cancella il lavoro.
        const inAttesa = Object.values(map).filter(
          (x) => x.status === "proposed" && x.proposed_by === "customer"
        );
        if (inAttesa.length > 0) {
          const { data: ev } = await supabase
            .from("appointment_events")
            .select("appointment_id, inizio_prima, inizio_dopo, created_at")
            .in("appointment_id", inAttesa.map((x) => x.id))
            .eq("tipo", "spostato")
            .eq("autore", "customer")
            .order("created_at", { ascending: false });
          for (const e of (ev ?? []) as {
            appointment_id: string;
            inizio_prima: string | null;
            inizio_dopo: string | null;
          }[]) {
            const x = map[e.appointment_id];
            if (
              x &&
              x.spostato_da === undefined &&
              e.inizio_prima &&
              e.inizio_dopo &&
              new Date(e.inizio_dopo).getTime() === new Date(x.starts_at).getTime()
            ) {
              x.spostato_da = e.inizio_prima;
            }
          }
        }
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
  function selectConversation(
    c: ConversationSummary,
    tocco?: { x: number; y: number }
  ) {
    // Dall'elenco la conversazione si apre dal punto del tocco, come dagli
    // altri tasti «Apri la chat». Il DOM cambia in modo sincrono (flushSync):
    // la transizione fotografa il prima e il dopo.
    if (tocco && keyOf(c) !== activeId) {
      transizioneNellaPagina("apri", tocco, () =>
        flushSync(() => {
          setActiveId(keyOf(c));
          setMobileThread(true);
        })
      );
    } else {
      setActiveId(keyOf(c));
      setMobileThread(true);
    }
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

  // SI APRE GIA' IN FONDO (07/10). La prima volta che una conversazione si
  // mostra, il salto all'ultimo messaggio e' immediato e avviene prima che
  // la pagina si disegni: niente scorrimento visibile dall'alto. I messaggi
  // che arrivano dopo scorrono dolcemente, come prima.
  const threadInFondo = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (!el || loadingMsgs) return;
    const prima = threadInFondo.current !== activeId;
    threadInFondo.current = activeId;
    el.scrollTo({ top: el.scrollHeight, behavior: prima ? "auto" : "smooth" });
  }, [messages, loadingMsgs, activeId]);

  // L'ALTEZZA UTILE (07/10): dal fondo dell'intestazione di Bob (che resta,
  // e' l'unico posto della campanella) al fondo dello schermo. Si misura,
  // non si indovina: sopra l'intestazione puo' esserci l'avviso di un fermo,
  // sotto quello di una cancellazione dell'account.
  const cornice = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(81);
  useLayoutEffect(() => {
    function misura() {
      const el = cornice.current;
      if (!el) return;
      setAlto(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)));
    }
    misura();
    window.addEventListener("resize", misura);
    const ro = new ResizeObserver(misura);
    const header = document.querySelector("header");
    if (header) ro.observe(header);
    return () => {
      window.removeEventListener("resize", misura);
      ro.disconnect();
    };
  }, [loading]);

  // Il ripiego dell'apertura animata, dove non ci sono le transizioni di
  // vista: la cornice appena montata cresce dal punto del tocco. Le
  // coordinate del tocco sono dello schermo; la cornice comincia sotto
  // l'intestazione, quindi si spostano nel suo riquadro.
  const [ripiego, setRipiego] = useState(false);
  useLayoutEffect(() => {
    if (!mobileThread && activeId === null) return;
    if (!cornice.current || !usaRipiego()) return;
    const b = cornice.current.getBoundingClientRect();
    const st = document.documentElement.style;
    const x = parseFloat(st.getPropertyValue("--chat-x")) || b.width / 2;
    const y = parseFloat(st.getPropertyValue("--chat-y")) || b.height / 2;
    cornice.current.style.setProperty("--chat-x", `${x - b.left}px`);
    cornice.current.style.setProperty("--chat-y", `${y - b.top}px`);
    setRipiego(true);
    const t = setTimeout(() => setRipiego(false), 320);
    return () => clearTimeout(t);
  }, [mobileThread, activeId, loading]);

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

  // A TUTTO SCHERMO (07/10, Lucio). Prima /messaggi era una finestra alta
  // 600px dentro la pagina, con l'intestazione «Le tue conversazioni» sopra
  // e il piede sotto. Adesso e' l'impianto di WhatsApp desktop — senza la
  // sua barra stretta di navigazione: l'intestazione di Bob resta (e' l'unico
  // posto della campanella) e sotto c'e' tutta l'altezza dello schermo. A
  // sinistra l'elenco, che scorre per conto suo; a destra la conversazione,
  // con il campo di scrittura ancorato in basso. A 390px una colonna alla
  // volta: l'elenco, o la conversazione con il tasto indietro. Aree di tocco
  // di 44px (PR #145, #146).
  return (
    <div
      ref={cornice}
      className={`flex w-full overflow-hidden bg-white ${ripiego ? "chat-apertura" : ""}`}
      style={{ height: `calc(100dvh - ${alto}px)` }}
      data-testid="chat-cornice"
    >
      {loadingConvs ? (
        <div className="m-4 flex-1 animate-pulse rounded-2xl bg-black/[0.03]" />
      ) : conversations.length === 0 ? (
        <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bob-indigo-50 text-bob-indigo">
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-semibold text-bob-ink">Nessuna conversazione</h1>
          <p className="text-sm text-bob-ink/70">
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
        <>
          {/* L'elenco: su mobile sparisce quando una conversazione e' aperta. */}
          <aside
            className={`min-h-0 w-full shrink-0 flex-col border-r border-black/[0.07] md:flex md:w-[320px] lg:w-[360px] ${
              mobileThread ? "hidden" : "flex"
            }`}
            data-testid="chat-elenco"
          >
            <div className="shrink-0 border-b border-black/[0.07] px-4 py-3">
              <h1 className="text-lg font-bold tracking-tight text-bob-ink">
                Messaggi
              </h1>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-black/5 overflow-y-auto overscroll-contain">
              {conversations.map((c) => {
                const isActive = keyOf(c) === activeId;
                return (
                  <button
                    key={keyOf(c)}
                    onClick={(e) => selectConversation(c, puntoDelTocco(e))}
                    className={`flex min-h-[64px] w-full flex-col justify-center gap-0.5 px-4 py-3 text-left transition ${
                      isActive ? "bg-bob-indigo-50" : "hover:bg-black/[0.02]"
                    }`}
                    aria-current={isActive ? "true" : undefined}
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
            </div>
          </aside>

          {/* La conversazione: su mobile solo quando e' aperta. */}
          <section
            className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${
              mobileThread ? "flex" : "hidden"
            }`}
            data-testid="chat-conversazione"
          >
            {active ? (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-black/[0.07] px-2 py-2 sm:px-4">
                  <button
                    onClick={(e) => {
                      const tocco = puntoDelTocco(e);
                      transizioneNellaPagina("chiudi", tocco, () =>
                        flushSync(() => setMobileThread(false))
                      );
                    }}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-bob-ink/70 hover:bg-black/[0.04] hover:text-bob-indigo md:hidden"
                    aria-label="Torna alle conversazioni"
                    data-testid="button-back-to-list"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="min-w-0 pl-1 md:pl-0">
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
                      className="btn-secondary ml-auto inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs"
                      data-testid="button-propose-appointment"
                    >
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Proponi appuntamento</span>
                      <span className="sm:hidden">Proponi</span>
                    </button>
                  )}
                </div>

                <div
                  ref={threadRef}
                  className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain bg-[#fafafb] px-3 py-4 sm:px-6"
                  data-testid="chat-messaggi"
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
                      m.kind === "appointment_proposal" &&
                      m.appointmentId &&
                      ultimoMessaggioPerAppuntamento.get(m.appointmentId) === m.id
                        ? threadAppts[m.appointmentId]
                        : undefined;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          mine ? "items-end" : "items-start"
                        }`}
                      >
                        {/* Una proposta e' un biglietto, non una frase: la
                            bolla resta solo se il biglietto non si e'
                            potuto leggere. TRANNE SULL'ANNULLATO (rilievo
                            del 5/10): il messaggio che porta quel
                            biglietto e' l'annullamento stesso, e il suo
                            testo ha il «Motivo: …» che il biglietto non
                            dice. Senza la bolla non lo leggeva nessuno. */}
                        {(!appt || appt.status === "cancelled") && (
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
                        )}
                        {appt && user && (
                          <div
                            className={`flex w-full max-w-sm flex-col ${
                              mine ? "items-end" : "items-start"
                            }`}
                          >
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
                              zona={active?.cityName ?? null}
                              onChanged={() =>
                                loadThread(activeR as string, activeP)
                              }
                              onProModify={apriModifica}
                            />
                            <p className="mt-1 px-1 text-2xs text-bob-ink/65">
                              {fmtTime(m.createdAt)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                  )}
                </div>

                <div className="flex shrink-0 gap-2 border-t border-black/[0.07] bg-white px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !sending && handleSend()
                    }
                    placeholder="Scrivi un messaggio…"
                    className="input-bob min-h-[44px] py-2.5"
                    data-testid="input-message"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="btn-primary min-h-[44px] py-2.5"
                    data-testid="button-send-message"
                  >
                    Invia
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-[#fafafb] text-sm text-bob-ink/65">
                Seleziona una conversazione
              </div>
            )}
          </section>
        </>
      )}

      {proposeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="propose-titolo"
          onClick={chiudiProposta}
        >
          {/* IN ORDINE DI IMPORTANZA (01/10, Lucio). I campi di data e ora e
              la conferma dell'orario scelto c'erano gia', ma stavano sotto un
              calendario alto 560px: fuori dalla parte visibile, tanto che
              sembravano non esistere. Adesso da PC il calendario sta a
              sinistra e il biglietto, con i suoi campi, a destra, sempre in
              vista; da telefono i campi vengono prima del calendario. E
              l'orario scelto e' scritto nella barra in fondo, che non scorre
              mai via. */}
          <div
            className="card flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            data-testid="dialog-propose-appointment"
          >
            <div className="shrink-0 border-b border-black/5 px-5 py-3.5 sm:px-6">
              <h3 id="propose-titolo" className="text-lg font-bold text-bob-ink">
                {replacingApptId
                  ? "Proponi un altro orario"
                  : "Proponi un appuntamento"}
              </h3>
              <p className="mt-0.5 text-sm text-bob-ink/70">
                {replacingApptId
                  ? "La proposta del cliente viene rifiutata e sostituita da questa. "
                  : ""}
                {active?.counterpartName ?? "Il cliente"} riceve un biglietto
                in chat e lo conferma con un tocco.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                {/* --- Il biglietto: anteprima e campi --- */}
                <div className="flex min-w-0 flex-col gap-4 lg:order-2">
                  <div className="hidden lg:block" data-testid="propose-anteprima">
                    <p className="label-bob">Cosa riceve {active?.counterpartName ?? "il cliente"}</p>
                    <div className="mt-1.5">
                      <BigliettoAppuntamento
                        intestazione="La tua proposta"
                        stato={{ etichetta: "Anteprima", tono: "anteprima" }}
                        inizio={inizioScelto ?? new Date(NaN)}
                        durataMinuti={apptDuration}
                        titolo={apptTitle.trim() || active?.serviceName || null}
                        luogo={active?.cityName ?? null}
                        prezzo={
                          prezzoNum != null && !Number.isNaN(prezzoNum)
                            ? prezzoNum
                            : null
                        }
                        note={apptNote.trim() || null}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                        step={300}
                        value={apptTime}
                        onChange={(e) => setApptTime(e.target.value)}
                        className="input-bob mt-1.5"
                        data-testid="input-appt-time"
                      />
                    </div>
                    <div className="col-span-2 min-w-0">
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
                    <div className="col-span-2 min-w-0">
                      <label className="label-bob" htmlFor="appt-title">Cosa</label>
                      <input
                        id="appt-title"
                        value={apptTitle}
                        onChange={(e) => setApptTitle(e.target.value)}
                        placeholder={active?.serviceName ?? "Es. sopralluogo"}
                        className="input-bob mt-1.5"
                        maxLength={80}
                        data-testid="input-appt-title"
                      />
                    </div>
                    <div className="col-span-2 min-w-0">
                      <label className="label-bob" htmlFor="appt-prezzo">
                        Prezzo
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="appt-prezzo"
                          inputMode="decimal"
                          value={apptPrezzo}
                          onChange={(e) => setApptPrezzo(e.target.value)}
                          placeholder="Da concordare"
                          className="input-bob pr-8"
                          aria-describedby="appt-prezzo-nota"
                          data-testid="input-appt-prezzo"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-bob-ink/65">
                          €
                        </span>
                      </div>
                      <p id="appt-prezzo-nota" className="mt-1 text-2xs text-bob-ink/65">
                        Lascialo vuoto se lo decidete sul posto.
                      </p>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <label className="label-bob" htmlFor="appt-note">
                        Note per il cliente (facoltative)
                      </label>
                      <textarea
                        id="appt-note"
                        value={apptNote}
                        onChange={(e) => setApptNote(e.target.value)}
                        placeholder="Cosa è compreso, cosa preparare…"
                        className="input-bob mt-1.5"
                        rows={2}
                        maxLength={300}
                        data-testid="input-appt-note"
                      />
                    </div>
                  </div>
                </div>

                {/* --- Il calendario --- */}
                <div className="min-w-0 lg:order-1">
                  {orariMiei === false && (
                    <div
                      className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
                      data-testid="propose-orari-mancanti"
                    >
                      Non hai ancora confermato i tuoi orari, quindi qui non ti
                      suggerisco niente: scegli nel calendario o scrivi data e
                      ora, oppure{" "}
                      <Link
                        href="/impostazioni/orari"
                        className="font-semibold underline underline-offset-2"
                      >
                        confermali una volta per tutte
                      </Link>{" "}
                      — da lì in poi te li propongo io, e i clienti vedono i
                      tuoi orari veri invece di doverti scrivere.
                    </div>
                  )}
                  {quickSlots.length > 0 && (
                    <div className="mb-3">
                      <p className="label-bob">I tuoi prossimi orari liberi</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {quickSlots.map((d) => {
                          const pad = (n: number) => String(n).padStart(2, "0");
                          const sel =
                            apptDate ===
                              `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
                                d.getDate()
                              )}` &&
                            apptTime === `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
                  {/* IL CALENDARIO VERO, ANCHE QUI (12/09, Lucio). Si clicca
                      lo spazio vuoto e l'orario compare come blocco; il blocco
                      si trascina per spostarlo e si tira dal bordo in basso
                      per cambiare la durata (01/10). I campi seguono. */}
                  <div className="rounded-xl border border-black/[0.07] p-2 sm:p-3">
                    <ProCalendar
                      appointments={myAppts}
                      loading={false}
                      onCreateAt={(start) => pickQuickSlot(start)}
                      onSelect={() => {}}
                      selectedId={replacingApptId}
                      bozza={
                        inizioScelto && !isNaN(inizioScelto.getTime())
                          ? {
                              start: inizioScelto,
                              durationMinutes: Math.max(apptDuration, 5),
                              conflitto,
                            }
                          : null
                      }
                      onBozzaChange={(start, durata) => {
                        pickQuickSlot(start);
                        setDurataOre(Math.floor(durata / 60));
                        setDurataMin(durata % 60);
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-2xs text-bob-ink/65">
                    Clicca uno spazio libero. Poi trascina il blocco per
                    spostarlo, o tiralo dal bordo in basso per allungarlo.
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-black/5 px-4 py-3 sm:px-6">
              <div
                className="text-sm"
                data-testid="propose-slot-scelto"
                aria-live="polite"
              >
                {inizioScelto && !isNaN(inizioScelto.getTime()) ? (
                  <p className="font-semibold text-bob-ink">
                    <span className="capitalize">
                      {inizioScelto.toLocaleString("it-IT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    {", "}
                    {inizioScelto.toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {new Date(
                      inizioScelto.getTime() + apptDuration * 60000
                    ).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <span className="font-normal text-bob-ink/65">
                      {" · "}
                      {prezzoNum != null && !Number.isNaN(prezzoNum)
                        ? prezzoLeggibile(prezzoNum)
                        : "prezzo da concordare"}
                    </span>
                  </p>
                ) : (
                  <p className="text-bob-ink/65">
                    Scegli un orario nel calendario o scrivi data e ora.
                  </p>
                )}
                {conflitto && avvisoSovrapposizione.mostra && (
                  <div className="mt-1">
                    <AvvisoSovrapposizione
                      conflitti={conflitti}
                      onSpegni={avvisoSovrapposizione.spegni}
                      testo={
                        sovrapposizioneVista
                          ? "Se va bene così, invia di nuovo."
                          : undefined
                      }
                    />
                  </div>
                )}
                {!conflitto && fuoriOrario && (
                  <p
                    className="mt-0.5 text-xs text-amber-800"
                    data-testid="propose-fuori-orario"
                  >
                    Fuori dalle fasce che hai dichiarato: puoi proporlo lo
                    stesso, ma il cliente non lo troverà mai fra gli orari che
                    gli mostriamo da solo.
                  </p>
                )}
                {apptErr && (
                  <p className="mt-0.5 text-xs text-red-600">{apptErr}</p>
                )}
              </div>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={chiudiProposta}
                  className="btn-secondary flex-1 py-2.5 sm:flex-none sm:px-6"
                >
                  Annulla
                </button>
                <button
                  onClick={proposeAppointment}
                  disabled={apptSaving || !apptDate || apptDuration <= 0}
                  className="btn-primary flex-1 py-2.5"
                  data-testid="button-appt-send"
                >
                  {apptSaving
                    ? "Invio…"
                    : sovrapposizioneVista && conflitto
                      ? "Invia lo stesso"
                      : "Invia proposta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
