// Funzioni dati lato client per conversazioni, messaggi e appuntamenti.
// Usano il client browser di Supabase (RLS attive: ognuno vede solo ciò che gli spetta).

import { createClient } from "@/lib/supabase/client";
import type {
  Appointment,
  ChatMessage,
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
export async function getConversations(
  userId: string,
  role: Role
): Promise<ConversationSummary[]> {
  const supabase = createClient();

  // Raccoglie gli id richiesta pertinenti in base al ruolo.
  let requestIds: string[] = [];

  if (role === "professional") {
    const proId = await getMyProfessionalId(userId);
    if (!proId) return [];
    const { data } = await supabase
      .from("request_professionals")
      .select("request_id")
      .eq("professional_id", proId);
    requestIds = (data ?? []).map((r) => r.request_id as string);
  } else {
    const { data } = await supabase
      .from("requests")
      .select("id")
      .eq("customer_id", userId);
    requestIds = (data ?? []).map((r) => r.id as string);
  }

  if (requestIds.length === 0) return [];

  // Dati delle richieste con servizio/città e nome cliente.
  const { data: reqRows } = await supabase
    .from("requests")
    .select(
      "id, status, created_at, customer_id, services ( name ), cities ( name )"
    )
    .in("id", requestIds);

  // Nome controparte: per il pro = nome cliente; per il cliente = nome del pro coinvolto.
  const counterpartByRequest = new Map<string, string>();

  if (role === "professional") {
    // nomi clienti
    const customerIds = Array.from(
      new Set((reqRows ?? []).map((r) => r.customer_id as string))
    );
    if (customerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", customerIds);
      const nameByUser = new Map(
        (profs ?? []).map((p) => [p.user_id as string, p.full_name as string])
      );
      for (const r of reqRows ?? []) {
        counterpartByRequest.set(
          r.id as string,
          nameByUser.get(r.customer_id as string) ?? "Cliente"
        );
      }
    }
  } else {
    // nomi professionisti coinvolti
    // 1) collego ogni richiesta al professionista (e al suo user_id)
    const { data: links } = await supabase
      .from("request_professionals")
      .select("request_id, professionals ( user_id )")
      .in("request_id", requestIds);

    const userIdByRequest = new Map<string, string>();
    const proUserIds = new Set<string>();
    for (const l of links ?? []) {
      const rec = l as Record<string, unknown>;
      const pro = rec.professionals as { user_id?: string } | null;
      const rid = rec.request_id as string;
      if (pro?.user_id && !userIdByRequest.has(rid)) {
        userIdByRequest.set(rid, pro.user_id);
        proUserIds.add(pro.user_id);
      }
    }

    // 2) recupero i nomi dei professionisti da profiles
    const nameByUser = new Map<string, string>();
    if (proUserIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", Array.from(proUserIds));
      for (const p of (profs ?? []) as {
        user_id: string;
        full_name: string | null;
      }[]) {
        if (p.full_name) nameByUser.set(p.user_id, p.full_name);
      }
    }

    for (const [rid, uid] of userIdByRequest) {
      counterpartByRequest.set(rid, nameByUser.get(uid) ?? "Professionista");
    }
  }

  // Ultimo messaggio per ciascuna richiesta.
  const { data: msgs } = await supabase
    .from("request_messages")
    .select("request_id, message, created_at")
    .in("request_id", requestIds)
    .order("created_at", { ascending: false });

  const lastByRequest = new Map<string, { message: string; at: string }>();
  for (const m of msgs ?? []) {
    const rid = m.request_id as string;
    if (!lastByRequest.has(rid)) {
      lastByRequest.set(rid, {
        message: m.message as string,
        at: m.created_at as string,
      });
    }
  }

  const out: ConversationSummary[] = (reqRows ?? []).map((r) => {
    const rec = r as Record<string, unknown>;
    const svc = rec.services as { name: string } | null;
    const city = rec.cities as { name: string } | null;
    const last = lastByRequest.get(rec.id as string);
    return {
      requestId: rec.id as string,
      serviceName: svc?.name ?? null,
      cityName: city?.name ?? null,
      counterpartName: counterpartByRequest.get(rec.id as string) ?? "—",
      lastMessage: last?.message ?? null,
      lastAt: last?.at ?? (rec.created_at as string) ?? null,
      status: rec.status as string,
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
  myType: "customer" | "professional"
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("request_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .neq("sender_type", myType)
    .is("read_at", null);
}

// Messaggi di una conversazione (in ordine cronologico).
export async function getMessages(requestId: string): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("request_messages")
    .select("id, sender_type, message, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((m) => ({
    id: m.id as string,
    senderType: m.sender_type as "customer" | "professional",
    message: m.message as string,
    createdAt: (m.created_at as string) ?? null,
  }));
}

// Invia un messaggio nella conversazione.
export async function sendMessage(
  requestId: string,
  userId: string,
  senderType: "customer" | "professional",
  message: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("request_messages").insert({
    request_id: requestId,
    sender_id: userId,
    sender_type: senderType,
    message,
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
