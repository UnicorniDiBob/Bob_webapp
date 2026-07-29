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

// Restituisce l'id del professionista collegato all'utente (se è un pro).
export async function getMyProfessionalId(
  userId: string
): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
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
    const { data } = await supabase
      .from("request_professionals")
      .select("request_id")
      .eq("professional_id", myProId);
    pairs = (data ?? []).map((r) => ({
      requestId: r.request_id as string,
      professionalId: myProId,
      proUserId: null,
    }));
  } else {
    const { data: reqs } = await supabase
      .from("requests")
      .select("id")
      .eq("customer_id", userId);
    const ids = (reqs ?? []).map((r) => r.id as string);
    if (ids.length === 0) return [];
    const { data: links } = await supabase
      .from("request_professionals")
      .select("request_id, professional_id, professionals ( user_id )")
      .in("request_id", ids);
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

  const { data: reqRows } = await supabase
    .from("requests")
    .select(
      "id, status, created_at, customer_id, services ( name ), cities ( name )"
    )
    .in("id", requestIds);
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
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", wantedUserIds);
    for (const p of (profs ?? []) as {
      user_id: string;
      full_name: string | null;
    }[]) {
      if (p.full_name) nameByUser.set(p.user_id, p.full_name);
    }
  }

  // Ultimo messaggio per thread (chiave richiesta:pro).
  const { data: msgs } = await supabase
    .from("request_messages")
    .select("request_id, professional_id, message, created_at")
    .in("request_id", requestIds)
    .order("created_at", { ascending: false });

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
    const { data } = await supabase
      .from("request_professionals")
      .select("request_id")
      .eq("professional_id", proId);
    return (data ?? []).map((r) => r.request_id as string);
  }
  const { data } = await supabase
    .from("requests")
    .select("id")
    .eq("customer_id", userId);
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
  const { data } = await q.order("created_at", { ascending: true });
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
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("professional_id", professionalId)
    .order("starts_at", { ascending: true });
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
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("appointments").update(data).eq("id", id);
  return { error: error ? error.message : null };
}

export async function deleteAppointment(
  id: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  return { error: error ? error.message : null };
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
