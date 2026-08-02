// Invio email transazionali via Resend (server-only).
// DORMANTE finché RESEND_API_KEY non è configurata: senza chiave ogni invio
// è un no-op silenzioso, così il codice può stare in produzione prima
// dell'attivazione dell'account. Solo email transazionali (nuova richiesta,
// nuovo messaggio, appuntamenti): niente marketing, niente soft opt-in —
// coerente con le regole privacy del progetto (base giuridica: contratto).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.meetonda.com";

// Mittente: EMAIL_FROM se impostata, altrimenti default sul dominio.
// Va verificato in Resend (DNS) prima che gli invii vadano a buon fine.
const FROM = process.env.EMAIL_FROM ?? "Bob <noreply@meetonda.com>";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Invio best-effort: non lancia mai; le notifiche non devono rompere i flussi.
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false; // dormant: nessuna chiave, nessun invio
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Perché ricevo questa email: cambia col tipo di comunicazione, e deve essere
// vero. Le email di verifica non nascono da una richiesta o da una chat.
const FOOTER_THREAD =
  "Ricevi questa email perché hai una richiesta o una conversazione attiva su BOB. È una comunicazione di servizio, non promozionale.";
const FOOTER_VERIFICATION =
  "Ricevi questa email perché hai chiesto la verifica del tuo profilo professionale su BOB. È una comunicazione di servizio, non promozionale.";

function shell(
  title: string,
  bodyHtml: string,
  ctaLabel: string,
  ctaHref: string,
  footer: string = FOOTER_THREAD
): string {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f4f4f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    <div style="font-weight:bold;font-size:22px;color:#3730a3;margin-bottom:16px;">BOB<span style="color:#f59e0b;">.</span></div>
    <div style="background:#ffffff;border-radius:16px;padding:24px;">
      <h1 style="font-size:18px;margin:0 0 12px;">${title}</h1>
      ${bodyHtml}
      <a href="${ctaHref}" style="display:inline-block;margin-top:20px;background:#3730a3;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;">${ctaLabel}</a>
    </div>
    <p style="font-size:12px;color:#6b7280;margin-top:16px;line-height:1.5;">
      ${footer}
    </p>
  </div></body></html>`;
}

export type NotifyEvent =
  | "new_request"
  | "new_message"
  | "appointment_proposed"
  | "appointment_confirmed"
  | "appointment_declined"
  // Esiti della verifica del profilo (blocco 10). Non passano da /api/notify:
  // non nascono da una richiesta, li invia la route admin che decide il caso.
  | "verification_granted"
  | "verification_docs_requested"
  | "verification_rejected";

/** Gli eventi legati a una richiesta o a un thread: hanno un piè di pagina diverso. */
const VERIFICATION_EVENTS: NotifyEvent[] = [
  "verification_granted",
  "verification_docs_requested",
  "verification_rejected",
];

export interface EmailContext {
  recipientName: string | null;
  senderName: string | null;
  serviceName: string | null;
  cityName: string | null;
  preview: string | null;
  link: string;
}

export function buildEmail(
  event: NotifyEvent,
  to: string,
  ctx: EmailContext
): OutgoingEmail {
  const href = `${SITE_URL}${ctx.link}`;
  const hi = ctx.recipientName
    ? `Ciao ${ctx.recipientName.split(" ")[0]},`
    : "Ciao,";
  const svc = ctx.serviceName ?? "un servizio";
  const who = ctx.senderName ?? "Un utente";
  const p = (t: string) =>
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px;color:#374151;">${t}</p>`;
  const quote = ctx.preview
    ? `<div style="border-left:3px solid #c7d2fe;padding:8px 12px;margin:12px 0;color:#4b5563;font-size:14px;background:#f5f6ff;">${escapeHtml(
        ctx.preview
      )}</div>`
    : "";

  let subject = "";
  let bodyHtml = "";
  let cta = "Apri su BOB";
  let text = "";

  switch (event) {
    case "new_request":
      subject = `Nuova richiesta: ${svc}${
        ctx.cityName ? ` a ${ctx.cityName}` : ""
      }`;
      bodyHtml =
        p(`${hi}`) +
        p(
          `Hai ricevuto una nuova richiesta per <b>${svc}</b>${
            ctx.cityName ? ` a ${ctx.cityName}` : ""
          }.`
        ) +
        quote +
        p("Rispondi in fretta: i clienti scelgono chi risponde prima.");
      cta = "Vedi la richiesta";
      text = `${hi}\nNuova richiesta per ${svc}${
        ctx.cityName ? ` a ${ctx.cityName}` : ""
      }.\n${ctx.preview ?? ""}\n${href}`;
      break;
    case "new_message":
      subject = `Nuovo messaggio da ${who}`;
      bodyHtml =
        p(`${hi}`) +
        p(
          `<b>${who}</b> ti ha scritto${
            ctx.serviceName ? ` per ${svc}` : ""
          }.`
        ) +
        quote;
      cta = "Leggi e rispondi";
      text = `${hi}\n${who} ti ha scritto.\n${ctx.preview ?? ""}\n${href}`;
      break;
    case "appointment_proposed":
      subject = `${who} ti propone un appuntamento`;
      bodyHtml =
        p(`${hi}`) +
        p(
          `<b>${who}</b> ti ha proposto un appuntamento${
            ctx.serviceName ? ` per ${svc}` : ""
          }.`
        ) +
        quote +
        p(
          "Puoi confermarlo, rifiutarlo o proporre un altro orario dalla tua area personale."
        );
      cta = "Vedi la proposta";
      text = `${hi}\n${who} ti propone un appuntamento.\n${
        ctx.preview ?? ""
      }\n${href}`;
      break;
    case "appointment_confirmed":
      subject = `Appuntamento confermato`;
      bodyHtml =
        p(`${hi}`) +
        p(
          `L'appuntamento${
            ctx.serviceName ? ` per ${svc}` : ""
          } con <b>${who}</b> è confermato.`
        ) +
        quote;
      cta = "Vedi i dettagli";
      text = `${hi}\nAppuntamento confermato con ${who}.\n${
        ctx.preview ?? ""
      }\n${href}`;
      break;
    case "appointment_declined":
      subject = `Aggiornamento sull'appuntamento`;
      bodyHtml =
        p(`${hi}`) +
        p(
          `<b>${who}</b> non può nell'orario proposto${
            ctx.serviceName ? ` per ${svc}` : ""
          }. Trovate insieme un'alternativa in chat.`
        ) +
        quote;
      cta = "Apri la conversazione";
      text = `${hi}\n${who} non può nell'orario proposto.\n${href}`;
      break;

    // --- Esiti della verifica (blocco 10) ---
    // ctx.preview porta la motivazione scritta da chi ha esaminato il caso:
    // è la stessa che il professionista legge nel suo profilo, e per il
    // Reg. UE 2019/1150 (P2B) deve essere una motivazione vera, non una formula.
    case "verification_granted":
      subject = "Il tuo profilo ora è verificato come Pro";
      bodyHtml =
        p(`${hi}`) +
        p(
          "abbiamo riscontrato la tua partita IVA: sul tuo profilo pubblico compare l'etichetta <b>Pro</b> con la data del controllo."
        ) +
        quote +
        p(
          "Il numero della partita IVA non è visibile ai clienti: vedono solo l'etichetta e la data."
        );
      cta = "Vedi il tuo profilo";
      text = `${hi}\nAbbiamo riscontrato la tua partita IVA: il tuo profilo ora mostra l'etichetta Pro con la data del controllo.\n${
        ctx.preview ?? ""
      }\n${href}`;
      break;
    case "verification_docs_requested":
      subject = "Ci serve un documento per completare la verifica";
      bodyHtml =
        p(`${hi}`) +
        p(
          "per completare la verifica della tua partita IVA ci serve un documento in più."
        ) +
        quote +
        p("Rispondi a questa email allegando quanto richiesto: facciamo il resto noi.");
      cta = "Vai al tuo profilo";
      text = `${hi}\nPer completare la verifica ci serve un documento in più.\n${
        ctx.preview ?? ""
      }\n${href}`;
      break;
    case "verification_rejected":
      subject = "Esito della verifica della tua partita IVA";
      bodyHtml =
        p(`${hi}`) +
        p("abbiamo esaminato la tua richiesta di verifica e non possiamo accoglierla.") +
        quote +
        p(
          "Se i dati che abbiamo controllato non sono corretti, puoi correggerli dal tuo profilo e ripresentare la richiesta: la rivediamo a mano."
        );
      cta = "Vai al tuo profilo";
      text = `${hi}\nAbbiamo esaminato la tua richiesta di verifica e non possiamo accoglierla.\n${
        ctx.preview ?? ""
      }\nPuoi correggere i dati dal tuo profilo e ripresentarla: ${href}`;
      break;
  }

  // Firma di chi ha seguito la pratica, come in fondo a una mail vera. Vale
  // solo per gli esiti di verifica: dietro c'è una persona che ha deciso, e
  // chi riceve un "no" ha diritto di sapere chi gliel'ha detto.
  const firma =
    VERIFICATION_EVENTS.includes(event) && ctx.senderName
      ? `<p style="font-size:14px;line-height:1.6;margin:16px 0 0;color:#6b7280;">Ha seguito la tua richiesta <b>${escapeHtml(
          ctx.senderName
        )}</b> — team BOB</p>`
      : "";
  if (firma) {
    bodyHtml += firma;
    text += `\n\nHa seguito la tua richiesta ${ctx.senderName} — team BOB`;
  }

  return {
    to,
    subject,
    html: shell(
      subject,
      bodyHtml,
      cta,
      href,
      VERIFICATION_EVENTS.includes(event) ? FOOTER_VERIFICATION : FOOTER_THREAD
    ),
    text,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
