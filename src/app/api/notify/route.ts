// POST /api/notify  { event, requestId, professionalId? }
// Notifica email transazionale: risolve il destinatario SERVER-SIDE (la
// controparte del thread, o i pro di una richiesta) e invia via Resend.
// Dormiente senza RESEND_API_KEY. Best-effort: risponde sempre 200, non
// blocca mai i flussi. Le email dei destinatari (auth.users) non escono
// mai dal server.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  buildEmail,
  emailEnabled,
  sendEmail,
  type NotifyEvent,
} from "@/lib/email";

export const runtime = "nodejs";

const EVENTS: NotifyEvent[] = [
  "new_request",
  "new_message",
  "appointment_proposed",
  "appointment_confirmed",
  "appointment_declined",
];

export async function POST(request: Request) {
  // Dormiente: senza chiave rispondiamo subito, nessun lavoro inutile.
  if (!emailEnabled()) return NextResponse.json({ sent: false });

  let body: { event?: string; requestId?: string; professionalId?: string; preview?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ sent: false });
  }
  const event = body.event as NotifyEvent;
  if (!EVENTS.includes(event) || !body.requestId) {
    return NextResponse.json({ sent: false });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ sent: false }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ sent: false });
  const admin = createServiceClient(url, serviceKey);

  try {
    // Richiesta + servizio/città + cliente.
    const { data: req } = await admin
      .from("requests")
      .select("id, customer_id, services ( name ), cities ( name )")
      .eq("id", body.requestId)
      .maybeSingle();
    if (!req) return NextResponse.json({ sent: false });

    // Il chiamante deve essere parte della richiesta (cliente o pro assegnato).
    const isCustomer = req.customer_id === user.id;
    const { data: myPro } = await admin
      .from("professionals")
      .select("id")
      .eq("user_id", user.id)
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

    if (event === "new_request") {
      // Il cliente contatta uno o più pro.
      let proIds: string[] = [];
      if (body.professionalId) proIds = [body.professionalId];
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
        const pid = body.professionalId ?? null;
        const uid = pid ? await proUserId(pid) : null;
        if (uid) targets.push({ userId: uid, proId: pid });
      } else {
        targets.push({ userId: req.customer_id as string, proId: myProId });
      }
    }

    const senderName = isCustomer
      ? await nameOf(user.id)
      : (myProId && (await nameOf(user.id))) || null;

    let sent = 0;
    for (const t of targets) {
      const to = await emailOf(t.userId);
      if (!to) continue;
      const recipientName = await nameOf(t.userId);
      // (033) anche gli eventi appuntamento portano nel thread: da lì si
      // approva, rifiuta o si propone un altro orario senza passare
      // dall'area personale.
      const link = `/messaggi?r=${req.id}${t.proId ? `&p=${t.proId}` : ""}`;
      const email = buildEmail(event, to, {
        recipientName,
        senderName,
        serviceName,
        cityName,
        preview: body.preview?.slice(0, 200) ?? null,
        link,
      });
      if (await sendEmail(email)) sent++;
    }
    return NextResponse.json({ sent });
  } catch {
    return NextResponse.json({ sent: false });
  }
}
