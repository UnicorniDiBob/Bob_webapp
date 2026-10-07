// Funzioni dati lato client per conversazioni, messaggi e appuntamenti.
// Usano il client browser di Supabase (RLS attive: ognuno vede solo ciò che gli spetta).

import { createClient } from "@/lib/supabase/client";
import type {
  Appointment,
  ChatMessage,
  ChatMessageKind,
  ConversationSummary,
} from "@/lib/supabase/types";

type Role = "customer" | "professional" | "admin" | "cs" | null;

// Un errore Postgrest qui diventa oggi un elenco vuoto plausibile — stesso
// difetto che ha nascosto cinque giorni di /api/match rotto in data.ts.
// Logga soltanto, non cambia nessun fallback.
function logQueryError(
  context: string,
  error: { message: string } | null
): void {
  if (error) console.error(`[messages] ${context} ha fallito:`, error);
}

// Restituisce l'id del professionista collegato all'utente (se è un pro).
export async function getMyProfessionalId(
  userId: string
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  logQueryError(`getMyProfessionalId(${userId})`, error);
  return (data?.id as string) ?? null;
}

// Elenco conversazioni dell'utente, ordinate dalla più recente.
// (022) Una conversazione = coppia (richiesta, professionista): il cliente
// di una richiesta multi-preventivo vede un thread per ogni pro contattato.
export async function getConversations(
  userId: string,
  role: Role
): Promise<ConversationSummary[]> {
  const supabase = createClient();

  interface Pair {
    requestId: string;
    professionalId: string;
    proUserId: string | null;
  }
  let pairs: Pair[] = [];

  if (role === "professional") {
    const myProId = await getMyProfessionalId(userId);
    if (!myProId) return [];
    const { data, error } = await supabase
      .from("request_professionals")
      .select("request_id")
      .eq("professional_id", myProId);
    logQueryError(`getConversations/request_professionals(${myProId})`, error);
    pairs = (data ?? []).map((r) => ({
      requestId: r.request_id as string,
      professionalId: myProId,
      proUserId: null,
    }));
  } else {
    const { data: reqs, error: reqsError } = await supabase
      .from("requests")
      .select("id")
      .eq("customer_id", userId);
    logQueryError(`getConversations/requests(${userId})`, reqsError);
    const ids = (reqs ?? []).map((r) => r.id as string);
    if (ids.length === 0) return [];
    const { data: links, error: linksError } = await supabase
      .from("request_professionals")
      .select("request_id, professional_id, professionals ( user_id )")
      .in("request_id", ids);
    logQueryError("getConversations/request_professionals(ids)", linksError);
    pairs = (links ?? []).map((l) => {
      const rec = l as Record<string, unknown>;
      const pro = rec.professionals as { user_id?: string } | null;
      return {
        requestId: rec.request_id as string,
        professionalId: rec.professional_id as string,
        proUserId: pro?.user_id ?? null,
      };
    });
  }

  if (pairs.length === 0) return [];
  const requestIds = Array.from(new Set(pairs.map((p) => p.requestId)));

  const { data: reqRows, error: reqRowsError } = await supabase
    .from("requests")
    .select(
      "id, status, created_at, customer_id, services ( name ), cities ( name )"
    )
    .in("id", requestIds);
  logQueryError("getConversations/requests(requestIds)", reqRowsError);
  const reqById = new Map(
    (reqRows ?? []).map((r) => [r.id as string, r as Record<string, unknown>])
  );

  // Nomi controparte (cliente per il pro; pro per il cliente).
  const nameByUser = new Map<string, string>();
  const wantedUserIds =
    role === "professional"
      ? Array.from(new Set((reqRows ?? []).map((r) => r.customer_id as string)))
      : (Array.from(
          new Set(pairs.map((p) => p.proUserId).filter(Boolean))
        ) as string[]);
  if (wantedUserIds.length) {
    const { data: profs, error: profsError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", wantedUserIds);
    logQueryError("getConversations/profiles", profsError);
    for (const p of (profs ?? []) as {
      user_id: string;
      full_name: string | null;
    }[]) {
      if (p.full_name) nameByUser.set(p.user_id, p.full_name);
    }
  }

  // Ultimo messaggio per thread (chiave richiesta:pro).
  const { data: msgs, error: msgsError } = await supabase
    .from("request_messages")
    .select("request_id, professional_id, message, created_at")
    .in("request_id", requestIds)
    .order("created_at", { ascending: false });
  logQueryError("getConversations/request_messages", msgsError);

  const lastByThread = new Map<string, { message: string; at: string }>();
  for (const m of msgs ?? []) {
    const key = `${m.request_id}:${m.professional_id ?? ""}`;
    if (!lastByThread.has(key)) {
      lastByThread.set(key, {
        message: m.message as string,
        at: m.created_at as string,
      });
    }
  }

  const out: ConversationSummary[] = pairs.map((p) => {
    const rec = reqById.get(p.requestId) ?? {};
    const svc = rec.services as { name: string } | null;
    const city = rec.cities as { name: string } | null;
    const last = lastByThread.get(`${p.requestId}:${p.professionalId}`);
    const counterpart =
      role === "professional"
        ? nameByUser.get(rec.customer_id as string) ?? "Cliente"
        : (p.proUserId && nameByUser.get(p.proUserId)) || "Professionista";
    return {
      requestId: p.requestId,
      professionalId: p.professionalId,
      serviceName: svc?.name ?? null,
      cityName: city?.name ?? null,
      counterpartName: counterpart,
      lastMessage: last?.message ?? null,
      lastAt: last?.at ?? ((rec.created_at as string) || null),
      status: (rec.status as string) ?? "sent",
    };
  });

  out.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return out;
}

// IDs delle richieste che appartengono all'utente (in base al ruolo).
async function myRequestIds(
  userId: string,
  role: Role
): Promise<string[]> {
  const supabase = createClient();
  if (role === "professional") {
    const proId = await getMyProfessionalId(userId);
    if (!proId) return [];
    const { data, error } = await supabase
      .from("request_professionals")
      .select("request_id")
      .eq("professional_id", proId);
    logQueryError(`myRequestIds/request_professionals(${proId})`, error);
    return (data ?? []).map((r) => r.request_id as string);
  }
  const { data, error } = await supabase
    .from("requests")
    .select("id")
    .eq("customer_id", userId);
  logQueryError(`myRequestIds/requests(${userId})`, error);
  return (data ?? []).map((r) => r.id as string);
}

// Numero totale di messaggi non letti ricevuti dall'utente (da usare per il badge).
export async function getUnreadCount(
  userId: string,
  role: Role
): Promise<number> {
  const myType: "customer" | "professional" =
    role === "professional" ? "professional" : "customer";
  const supabase = createClient();
  if (role === "professional") {
    // (022) il pro conta solo i messaggi del proprio thread.
    const proId = await getMyProfessionalId(userId);
    if (!proId) return 0;
    const { count } = await supabase
      .from("request_messages")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", proId)
      .neq("sender_type", myType)
      .is("read_at", null);
    return count ?? 0;
  }
  const requestIds = await myRequestIds(userId, role);
  if (requestIds.length === 0) return 0;
  const { count } = await supabase
    .from("request_messages")
    .select("id", { count: "exact", head: true })
    .in("request_id", requestIds)
    .neq("sender_type", myType)
    .is("read_at", null);
  return count ?? 0;
}

// Segna come letti i messaggi ricevuti in una conversazione.
export async function markConversationRead(
  requestId: string,
  professionalId: string | null,
  myType: "customer" | "professional"
): Promise<void> {
  const supabase = createClient();
  let q = supabase
    .from("request_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .neq("sender_type", myType)
    .is("read_at", null);
  if (professionalId) q = q.eq("professional_id", professionalId);
  await q;
}

// Messaggi di un thread (richiesta + professionista), in ordine cronologico.
export async function getMessages(
  requestId: string,
  professionalId: string | null
): Promise<ChatMessage[]> {
  const supabase = createClient();
  let q = supabase
    .from("request_messages")
    .select("id, sender_type, message, created_at, kind, appointment_id")
    .eq("request_id", requestId);
  if (professionalId) q = q.eq("professional_id", professionalId);
  const { data, error } = await q.order("created_at", { ascending: true });
  logQueryError(`getMessages(${requestId})`, error);
  return (data ?? []).map((m) => ({
    id: m.id as string,
    senderType: m.sender_type as "customer" | "professional",
    message: m.message as string,
    createdAt: (m.created_at as string) ?? null,
    kind: (m.kind as ChatMessageKind) ?? "text",
    appointmentId: (m.appointment_id as string | null) ?? null,
  }));
}

// Invia un messaggio nel thread (richiesta + professionista).
export async function sendMessage(
  requestId: string,
  professionalId: string | null,
  userId: string,
  senderType: "customer" | "professional",
  message: string,
  // (033) opzionale: collega il messaggio a un appuntamento, così la chat
  // può mostrarci sotto i tasti approva/rifiuta/modifica.
  opts?: { kind?: ChatMessageKind; appointmentId?: string | null }
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("request_messages").insert({
    request_id: requestId,
    professional_id: professionalId,
    sender_id: userId,
    sender_type: senderType,
    message,
    kind: opts?.kind ?? "text",
    appointment_id: opts?.appointmentId ?? null,
  });
  // Aggiorna lo stato della richiesta a "matched" (in contatto) se ancora aperta.
  if (!error) {
    await supabase
      .from("requests")
      .update({ status: "matched" })
      .eq("id", requestId)
      .in("status", ["sent", "quote_request"]);
  }
  return { error: error ? error.message : null };
}

// ----- Appuntamenti -----

export async function getAppointments(
  professionalId: string
): Promise<Appointment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("professional_id", professionalId)
    .order("starts_at", { ascending: true });
  logQueryError(`getAppointments(${professionalId})`, error);
  return (data ?? []) as Appointment[];
}

export interface NewAppointment {
  customer_name: string;
  title: string | null;
  starts_at: string; // ISO
  duration_minutes: number;
  price: number | null;
  status: Appointment["status"];
  notes: string | null;
  // Luogo (031): opzionali, così gli insert esistenti restano validi.
  location_address?: string | null;
  location_city?: string | null;
  location_notes?: string | null;
  // Per le Analisi (108): dove e che lavoro, senza i quali le scomposizioni
  // per zona e per servizio non vedono gli appuntamenti creati dal pro.
  comune_istat?: string | null;
  postal_code?: string | null;
  professional_service_id?: string | null;
}

export async function createAppointment(
  professionalId: string,
  data: NewAppointment
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("appointments")
    .insert({ professional_id: professionalId, ...data });
  return { error: error ? error.message : null };
}

export async function updateAppointment(
  id: string,
  data: Partial<NewAppointment>
): Promise<{ error: string | null; code?: string | null; hint?: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("appointments").update(data).eq("id", id);
  return {
    error: error ? error.message : null,
    code: error?.code ?? null,
    // «chiama» (116): spostare dal calendario dentro il preavviso.
    hint: error?.hint ?? null,
  };
}

/**
 * 23P01, hint «occupato»: l'orario si sovrappone a un altro appuntamento con
 * un cliente. Dalla 116 lo dice un trigger, e solo quando l'orario lo
 * sceglie il CLIENTE (prenotazione, controproposta, spostamento): al pro la
 * sovrapposizione e' permessa, con un avviso. Al pro arriva ancora in un
 * caso: rifiutare uno spostamento quando l'orario di prima e' stato preso.
 */
export const ERRORE_SOVRAPPOSIZIONE = "23P01";
export const TESTO_SOVRAPPOSIZIONE =
  "In quell'orario hai già un altro appuntamento con un cliente: scegline un altro.";

// ----- L'avviso di sovrapposizione, preferenza del pro (116) -----
//
// Una colonna su professionals, non localStorage: la scelta «non mostrarmelo
// piu'» segue il pro su ogni dispositivo. Se non si legge, l'avviso si
// mostra: meglio un avviso in piu' che una sovrapposizione a sorpresa.

export async function leggiAvvisoSovrapposizione(
  professionalId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("professionals")
    .select("avviso_sovrapposizione")
    .eq("id", professionalId)
    .maybeSingle();
  logQueryError(`leggiAvvisoSovrapposizione(${professionalId})`, error);
  return (
    (data as { avviso_sovrapposizione?: boolean } | null)?.avviso_sovrapposizione ?? true
  );
}

export async function salvaAvvisoSovrapposizione(
  professionalId: string,
  valore: boolean
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("professionals")
    .update({ avviso_sovrapposizione: valore })
    .eq("id", professionalId);
  return { error: error ? error.message : null };
}

export async function deleteAppointment(
  id: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  return { error: error ? error.message : null };
}

// ----- Annullare un appuntamento con un cliente (113) -----
//
// Una strada sola, per tutte e due le parti: la funzione annulla_appuntamento
// nel database. Controlla il preavviso con l'ora del server, scrive il
// messaggio standard in chat (con il motivo, se c'e': dalla 116 e'
// facoltativo anche per il pro) e, su una prenotazione diretta, chiude la
// richiesta come «disdetta». Un UPDATE dal browser su un appuntamento
// confermato con un cliente il database lo rifiuta (trigger
// proteggi_appuntamento_cliente).

export type MotivoRifiuto = "chiama" | "non_attivo" | "non_trovato" | "errore";

export type EsitoAnnullamento =
  | { ok: true }
  | { ok: false; motivo: MotivoRifiuto; messaggio: string };

export async function annullaAppuntamento(
  id: string,
  opts: { motivo?: string | null; concordatoTelefono?: boolean } = {}
): Promise<EsitoAnnullamento> {
  const supabase = createClient();
  const { error } = await supabase.rpc("annulla_appuntamento", {
    p_id: id,
    p_motivo: opts.motivo ?? null,
    p_concordato_telefono: opts.concordatoTelefono ?? false,
  });
  if (!error) return { ok: true };
  const noti: MotivoRifiuto[] = ["chiama", "non_attivo", "non_trovato"];
  const motivo = noti.includes(error.hint as MotivoRifiuto)
    ? (error.hint as MotivoRifiuto)
    : "errore";
  return {
    ok: false,
    motivo,
    messaggio: motivo === "errore" ? "Annullamento non riuscito. Riprova." : error.message,
  };
}

// ----- Il pro sposta un appuntamento con un cliente (116) -----
//
// La stessa funzione dello spostamento del cliente (115), con la regola
// dell'annullamento: fuori dal preavviso l'orario nuovo torna al cliente da
// confermare; dentro, solo dopo la telefonata, e allora resta confermato.
// Il pro puo' sovrapporsi: l'interfaccia l'ha gia' avvisato.

export type MotivoSpostamento =
  | "chiama"
  | "non_attivo"
  | "non_trovato"
  | "orario"
  | "errore";

export type EsitoSpostamento =
  | { ok: true; restaConfermato: boolean }
  | { ok: false; motivo: MotivoSpostamento; messaggio: string };

export async function spostaAppuntamentoPro(
  id: string,
  inizio: Date,
  opts: { motivo?: string | null; concordatoTelefono?: boolean } = {}
): Promise<EsitoSpostamento> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("sposta_appuntamento", {
    p_id: id,
    p_inizio: inizio.toISOString(),
    p_motivo: opts.motivo?.trim() || null,
    p_concordato_telefono: opts.concordatoTelefono ?? false,
  });
  if (!error) {
    return {
      ok: true,
      restaConfermato: Boolean((data as { resta_confermato?: boolean } | null)?.resta_confermato),
    };
  }
  const noti: MotivoSpostamento[] = ["chiama", "non_attivo", "non_trovato", "orario"];
  const motivo = noti.includes(error.hint as MotivoSpostamento)
    ? (error.hint as MotivoSpostamento)
    : "errore";
  if (motivo === "errore") logQueryError(`spostaAppuntamentoPro(${id})`, error);
  return {
    ok: false,
    motivo,
    messaggio: motivo === "errore" ? "Spostamento non riuscito. Riprova." : error.message,
  };
}

// ----- Il ritardo del pro (116) -----
//
// segnala_ritardo() nel database: l'appuntamento slitta di N minuti e resta
// confermato, il cliente lo legge in chat e in campanella. Con
// soloAnteprima non scrive niente e dice chi verrebbe toccato dopo: le
// regole restano in un posto solo, e l'anteprima non puo' dire «puoi»
// quando la scrittura direbbe «no».

export interface AppuntamentoToccato {
  id: string;
  request_id: string | null;
  customer_name: string | null;
  title: string | null;
  starts_at: string;
  slitta_minuti: number;
  /** false = voce dell'agenda privata: nessun cliente da avvisare. */
  avvisabile: boolean;
}

export type MotivoRitardo = "non_trovato" | "non_attivo" | "non_oggi" | "minuti" | "errore";

export type EsitoRitardo =
  | {
      ok: true;
      inizioPrima: string;
      inizioDopo: string;
      toccati: AppuntamentoToccato[];
      avvisati: number;
    }
  | { ok: false; motivo: MotivoRitardo; messaggio: string };

export async function segnalaRitardo(
  id: string,
  minuti: number,
  opts: { motivo?: string | null; avvisaToccati?: boolean; soloAnteprima?: boolean } = {}
): Promise<EsitoRitardo> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("segnala_ritardo", {
    p_id: id,
    p_minuti: minuti,
    p_motivo: opts.motivo?.trim() || null,
    p_avvisa_toccati: opts.avvisaToccati ?? false,
    p_solo_anteprima: opts.soloAnteprima ?? false,
  });
  if (!error) {
    const d = data as {
      inizio_prima: string;
      inizio_dopo: string;
      toccati: AppuntamentoToccato[] | null;
      avvisati?: number;
    };
    return {
      ok: true,
      inizioPrima: d.inizio_prima,
      inizioDopo: d.inizio_dopo,
      toccati: d.toccati ?? [],
      avvisati: d.avvisati ?? 0,
    };
  }
  const noti: MotivoRitardo[] = ["non_trovato", "non_attivo", "non_oggi", "minuti"];
  const motivo = noti.includes(error.hint as MotivoRitardo)
    ? (error.hint as MotivoRitardo)
    : "errore";
  if (motivo === "errore") logQueryError(`segnalaRitardo(${id})`, error);
  return {
    ok: false,
    motivo,
    messaggio: motivo === "errore" ? "Non sono riuscito a segnalare il ritardo. Riprova." : error.message,
  };
}

/**
 * Gli appuntamenti attivi del pro in una finestra di tempo, per dire «si
 * sovrappone a...» prima di salvare. La RLS lascia al pro solo i suoi.
 */
export async function appuntamentiDelPro(
  professionalId: string,
  dal: Date,
  al: Date
): Promise<Pick<Appointment, "id" | "starts_at" | "duration_minutes" | "status" | "customer_name" | "title">[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, duration_minutes, status, customer_name, title")
    .eq("professional_id", professionalId)
    .in("status", ["confirmed", "proposed"])
    .gte("starts_at", dal.toISOString())
    .lt("starts_at", al.toISOString())
    .order("starts_at", { ascending: true });
  logQueryError(`appuntamentiDelPro(${professionalId})`, error);
  return (data ?? []) as Pick<
    Appointment,
    "id" | "starts_at" | "duration_minutes" | "status" | "customer_name" | "title"
  >[];
}

/**
 * Nome e telefono dell'altra parte di un appuntamento CONFERMATO, per
 * «Chiama per annullare». null se non sei una delle parti o l'appuntamento
 * non e' confermato; telefono null se l'altra parte non l'ha lasciato.
 */
export async function contattoControparte(
  appointmentId: string
): Promise<{ nome: string | null; telefono: string | null } | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("contatto_controparte", {
    p_appuntamento: appointmentId,
  });
  logQueryError(`contattoControparte(${appointmentId})`, error);
  return (data as { nome: string | null; telefono: string | null } | null) ?? null;
}

// Statistiche del professionista calcolate dagli appuntamenti.
export interface ProStats {
  earningsMonth: number; // € guadagnati questo mese (completati)
  earningsTotal: number; // € guadagnati totali (completati)
  hoursMonth: number; // ore lavorate questo mese (completati)
  hoursBooked: number; // ore prenotate future (confermati)
  upcomingCount: number; // appuntamenti futuri confermati
  completedCount: number; // appuntamenti completati
}

export function computeStats(appointments: Appointment[]): ProStats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let earningsMonth = 0;
  let earningsTotal = 0;
  let hoursMonth = 0;
  let hoursBooked = 0;
  let upcomingCount = 0;
  let completedCount = 0;

  for (const a of appointments) {
    const start = new Date(a.starts_at);
    const hours = a.duration_minutes / 60;
    const price = a.price ?? 0;

    if (a.status === "completed") {
      completedCount += 1;
      earningsTotal += price;
      if (start >= monthStart) {
        earningsMonth += price;
        hoursMonth += hours;
      }
    }
    if (a.status === "confirmed" && start >= now) {
      upcomingCount += 1;
      hoursBooked += hours;
    }
  }

  return {
    earningsMonth: Math.round(earningsMonth),
    earningsTotal: Math.round(earningsTotal),
    hoursMonth: Math.round(hoursMonth * 10) / 10,
    hoursBooked: Math.round(hoursBooked * 10) / 10,
    upcomingCount,
    completedCount,
  };
}
