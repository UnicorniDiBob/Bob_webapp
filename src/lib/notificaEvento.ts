// LA NOTIFICA DI UN EVENTO, LATO SERVER (17/10, appuntamento-una-strada).
//
// Era il corpo di POST /api/notify. Sta qui perche' la chiamano anche le
// route che fanno il lavoro sul server (conferma e rifiuto di una proposta):
// la stessa notifica, con gli stessi destinatari e gli stessi testi, senza
// una seconda richiesta HTTP. /api/notify resta per il browser.
//
// Spenta finche' l'interruttore in src/lib/email.ts e' «spenta», e comunque
// senza RESEND_API_KEY. Non lancia mai: risponde quante email sono partite,
// o false.

import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  buildEmail,
  emailEnabled,
  sendEmail,
  type NotifyEvent,
} from "@/lib/email";

export async function notificaEvento(args: {
  /** Chi ha fatto l'azione: la notifica va alla controparte. */
  userId: string;
  event: NotifyEvent;
  requestId: string;
  professionalId?: string | null;
  preview?: string | null;
}): Promise<number | false> {
  if (!emailEnabled()) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;
  const admin = createServiceClient(url, serviceKey);

  try {
    // Richiesta + servizio/città + cliente.
    const { data: req } = await admin
      .from("requests")
      .select("id, customer_id, services ( name ), cities ( name )")
      .eq("id", args.requestId)
      .maybeSingle();
    if (!req) return false;

    // Il chiamante deve essere parte della richiesta (cliente o pro assegnato).
    const isCustomer = req.customer_id === args.userId;
    const { data: myPro } = await admin
      .from("professionals")
      .select("id")
      .eq("user_id", args.userId)
      .maybeSingle();
    const myProId = (myPro as { id: string } | null)?.id ?? null;

    // Le join Supabase possono arrivare come oggetto o array: normalizziamo.
    const relName = (rel: unknown): string | null => {
      const r = Array.isArray(rel) ? rel[0] : rel;
      return (r as { name?: string } | null)?.name ?? null;
    };
    const serviceName = relName(req.services);
    const cityName = relName(req.cities);

    const nameOf = async (userId: string | null): Promise<string | null> => {
      if (!userId) return null;
      const { data } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();
      return (data as { full_name: string | null } | null)?.full_name ?? null;
    };
    const emailOf = async (userId: string): Promise<string | null> => {
      const { data } = await admin.auth.admin.getUserById(userId);
      return data.user?.email ?? null;
    };
    const proUserId = async (proId: string): Promise<string | null> => {
      const { data } = await admin
        .from("professionals")
        .select("user_id")
        .eq("id", proId)
        .maybeSingle();
      return (data as { user_id: string | null } | null)?.user_id ?? null;
    };

    // Destinatari: coppie [proId, userId] o il cliente.
    const targets: { userId: string; proId: string | null }[] = [];

    if (args.event === "new_request") {
      // Il cliente contatta uno o più pro.
      let proIds: string[] = [];
      if (args.professionalId) proIds = [args.professionalId];
      else {
        const { data: links } = await admin
          .from("request_professionals")
          .select("professional_id")
          .eq("request_id", req.id);
        proIds = (links ?? []).map((l) => l.professional_id as string);
      }
      for (const pid of proIds) {
        const uid = await proUserId(pid);
        if (uid) targets.push({ userId: uid, proId: pid });
      }
    } else {
      // Messaggio/appuntamento: destinatario = la controparte del thread.
      if (isCustomer) {
        const pid = args.professionalId ?? null;
        const uid = pid ? await proUserId(pid) : null;
        if (uid) targets.push({ userId: uid, proId: pid });
      } else {
        targets.push({ userId: req.customer_id as string, proId: myProId });
      }
    }

    const senderName = isCustomer
      ? await nameOf(args.userId)
      : (myProId && (await nameOf(args.userId))) || null;

    let sent = 0;
    for (const t of targets) {
      const to = await emailOf(t.userId);
      if (!to) continue;
      const recipientName = await nameOf(t.userId);
      // (033) anche gli eventi appuntamento portano nel thread: da lì si
      // approva, rifiuta o si propone un altro orario senza passare
      // dall'area personale.
      const link = `/messaggi?r=${req.id}${t.proId ? `&p=${t.proId}` : ""}`;
      const email = buildEmail(args.event, to, {
        recipientName,
        senderName,
        serviceName,
        cityName,
        preview: args.preview?.slice(0, 200) ?? null,
        link,
      });
      if (await sendEmail(email)) sent++;
    }
    return sent;
  } catch {
    return false;
  }
}
