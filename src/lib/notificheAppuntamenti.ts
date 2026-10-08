// LE NOTIFICHE DEGLI APPUNTAMENTI (113, Lucio 05/10).
//
// Il canale che mancava. Una prenotazione, uno spostamento, un annullamento
// arrivavano solo come messaggio in chat: l'email e' spenta per scelta
// (src/lib/email.ts) e la campanella li escludeva. Chi non apriva la chat non
// lo sapeva. Adesso entrano nella campanella, derivati da due fonti che
// esistono gia':
//   1. lo storico appointment_events: le cose che ha fatto L'ALTRA parte negli
//      ultimi 30 giorni (quello che fai tu non ti si notifica);
//   2. le proposte aperte dall'altra parte, ancora da venire: sono «azione»,
//      restano accese finche' non rispondi, come una cosa da fare.
// Uno spostamento o una proposta ancora da confermare compaiono una volta
// sola, come cosa da fare, non anche come notizia.
//
// La RLS di appointment_events lascia leggere solo le due parti: qui non
// serve filtrare per utente, ma per ruolo (cosa ha fatto l'altro).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContestoNotifiche, Notifica } from "@/lib/notifiche";

const GIORNI = 30;

interface Evento {
  id: string;
  appointment_id: string;
  request_id: string;
  professional_id: string;
  tipo: string;
  autore: "professional" | "customer" | "sistema";
  inizio_prima: string | null;
  inizio_dopo: string | null;
  motivo: string | null;
  concordato_telefono: boolean;
  created_at: string;
  appointments: { title: string | null; customer_name: string | null } | null;
}

interface Proposta {
  id: string;
  request_id: string;
  professional_id: string;
  starts_at: string;
  title: string | null;
  customer_name: string | null;
  proposed_by: string;
}

function quando(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo l'ora, per un ritardo: il giorno e' oggi. */
function ora(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function chat(requestId: string, professionalId: string): string {
  return `/messaggi?r=${requestId}&p=${professionalId}`;
}

/** Nomi dei professionisti, per il cliente: «Marco Rossi», non un id. */
async function nomiPro(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data: pros } = await supabase
    .from("professionals")
    .select("id, user_id")
    .in("id", ids);
  const perUtente = new Map<string, string>();
  for (const p of (pros ?? []) as { id: string; user_id: string | null }[]) {
    if (p.user_id) perUtente.set(p.user_id, p.id);
  }
  if (perUtente.size === 0) return out;
  const { data: profili } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", Array.from(perUtente.keys()));
  for (const pr of (profili ?? []) as { user_id: string; full_name: string | null }[]) {
    const proId = perUtente.get(pr.user_id);
    if (proId && pr.full_name) out.set(proId, pr.full_name);
  }
  return out;
}

/** Non lancia mai: una voce che non si legge sparisce, le altre restano. */
export async function caricaNotificheAppuntamenti(
  supabase: SupabaseClient,
  ctx: ContestoNotifiche
): Promise<Notifica[]> {
  try {
    return await carica(supabase, ctx);
  } catch (e) {
    console.error("[notifiche] appuntamenti:", e);
    return [];
  }
}

async function carica(
  supabase: SupabaseClient,
  ctx: ContestoNotifiche
): Promise<Notifica[]> {
  const io: "professional" | "customer" =
    ctx.role === "professional" ? "professional" : "customer";
  const altro = io === "professional" ? "customer" : "professional";
  const dal = new Date(Date.now() - GIORNI * 86_400_000).toISOString();

  const [eventi, proposte] = await Promise.all([
    supabase
      .from("appointment_events")
      .select(
        "id, appointment_id, request_id, professional_id, tipo, autore, inizio_prima, inizio_dopo, motivo, concordato_telefono, created_at, appointments ( title, customer_name )"
      )
      .eq("autore", altro)
      .gte("created_at", dal)
      .order("created_at", { ascending: false })
      .limit(30),
    // Le proposte dell'altra parte che aspettano me. La RLS di appointments
    // le limita gia' alle mie (pro proprietario, o cliente della richiesta).
    supabase
      .from("appointments")
      .select("id, request_id, professional_id, starts_at, title, customer_name, proposed_by")
      .eq("status", "proposed")
      .eq("proposed_by", altro)
      .not("request_id", "is", null)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10),
  ]);
  if (eventi.error) console.error("[notifiche] appointment_events:", eventi.error);
  if (proposte.error) console.error("[notifiche] proposte aperte:", proposte.error);

  const ev = (eventi.data ?? []) as unknown as Evento[];
  const pr = (proposte.data ?? []) as Proposta[];

  const nomi =
    io === "customer"
      ? await nomiPro(
          supabase,
          Array.from(new Set([...ev, ...pr].map((x) => x.professional_id)))
        )
      : new Map<string, string>();
  const chi = (proId: string, cliente: string | null | undefined) =>
    io === "professional"
      ? cliente || "Il cliente"
      : nomi.get(proId) || "Il professionista";

  const out: Notifica[] = [];
  const aperte = new Set(pr.map((p) => p.id));

  // 1. Da fare: le proposte che aspettano una risposta.
  for (const p of pr) {
    const nome = chi(p.professional_id, p.customer_name);
    out.push({
      id: `appuntamento:da-confermare:${p.id}:${p.starts_at}`,
      livello: "azione",
      titolo: `${nome} ti propone un appuntamento`,
      testo: `${quando(p.starts_at)}${p.title ? ` · ${p.title}` : ""}. Confermalo o proponi un altro orario.`,
      href: chat(p.request_id, p.professional_id),
      azione: "Rispondi in chat",
      quando: null,
      mittente: nome,
    });
  }

  // 2. Le notizie: cosa ha fatto l'altra parte.
  for (const e of ev) {
    // Gia' sopra come cosa da fare.
    if (
      aperte.has(e.appointment_id) &&
      (e.tipo === "proposto" || e.tipo === "spostato" || e.tipo === "riproposto")
    ) {
      continue;
    }
    const nome = chi(e.professional_id, e.appointments?.customer_name);
    const titolo = e.appointments?.title ? ` · ${e.appointments.title}` : "";
    const motivo = e.motivo ? ` Motivo: «${e.motivo}».` : "";
    let t: { titolo: string; testo: string; disdetta?: Notifica["disdetta"] } | null = null;
    switch (e.tipo) {
      case "prenotato":
        t = {
          titolo: `Nuova prenotazione da ${nome}`,
          testo: `${quando(e.inizio_dopo)}${titolo}. È già confermata: la trovi nel calendario.`,
        };
        break;
      case "confermato":
        t = {
          titolo: `${nome} ha confermato l'appuntamento`,
          testo: `${quando(e.inizio_dopo)}${titolo}.`,
        };
        break;
      // IL RIFIUTO DI UNO SPOSTAMENTO (118): il pro ha detto no allo
      // spostamento chiesto dal cliente e l'appuntamento e' tornato
      // all'orario di prima. Lo storico lo scrive come 'rifiutato' con due
      // orari DIVERSI (prima = quello chiesto, dopo = quello che resta); un
      // rifiuto qualunque li ha uguali.
      case "rifiutato":
        t =
          e.inizio_prima &&
          e.inizio_dopo &&
          new Date(e.inizio_prima).getTime() !== new Date(e.inizio_dopo).getTime()
            ? {
                titolo: `${nome} non ha potuto spostare l'appuntamento`,
                testo: `Resta ${quando(e.inizio_dopo)}${titolo}.`,
              }
            : {
                titolo: `${nome} non ha accettato l'orario`,
                testo: `${quando(e.inizio_prima ?? e.inizio_dopo)}${titolo}. Scrivetevi per trovarne un altro.`,
              };
        break;
      // LA DISDETTA SI VEDE (07/10): oltre al testo, i pezzi per
      // disegnarla in evidenza (NotificaVoce) — l'orario che salta, chi, il
      // motivo. Il testo resta, per chi legge solo quello.
      case "annullato":
        t = {
          titolo:
            io === "professional"
              ? `${nome} ha disdetto la prenotazione`
              : `${nome} ha annullato l'appuntamento`,
          testo: `Era ${quando(e.inizio_prima ?? e.inizio_dopo)}${titolo}.${
            e.concordato_telefono ? " Come concordato al telefono." : ""
          }${motivo}`,
          disdetta: {
            orario: `${quando(e.inizio_prima ?? e.inizio_dopo)}${titolo}`,
            chi: nome,
            motivo: e.motivo,
            concordatoTelefono: e.concordato_telefono,
          },
        };
        break;
      case "ritirato":
        t = {
          titolo: `${nome} ha ritirato la proposta`,
          testo: `${quando(e.inizio_prima ?? e.inizio_dopo)}${titolo}.`,
        };
        break;
      case "spostato":
        t = {
          titolo: `${nome} ha spostato l'appuntamento`,
          testo: `Da ${quando(e.inizio_prima)} a ${quando(e.inizio_dopo)}${titolo}.${
            e.concordato_telefono ? " Come concordato al telefono." : ""
          }`,
        };
        break;
      // IL RITARDO (116): non e' uno spostamento da confermare, e' una
      // notizia. L'appuntamento resta confermato all'ora nuova.
      case "ritardo":
        t = {
          titolo: `${nome} è in ritardo`,
          testo: `Arriva alle ${ora(e.inizio_dopo)} invece che alle ${ora(e.inizio_prima)}${titolo}. L'appuntamento resta confermato.${motivo}`,
        };
        break;
      default:
        t = null;
    }
    if (!t) continue;
    out.push({
      id: `appuntamento:evento:${e.id}`,
      livello: "avviso",
      titolo: t.titolo,
      testo: t.testo,
      href: chat(e.request_id, e.professional_id),
      azione: t.disdetta ? "Apri la conversazione" : "Apri la chat",
      quando: e.created_at,
      mittente: nome,
      ...(t.disdetta ? { disdetta: t.disdetta } : {}),
    });
  }
  return out;
}
