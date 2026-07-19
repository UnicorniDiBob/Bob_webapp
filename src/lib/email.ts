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

function shell(
  title: string,
  bodyHtml: string,
  ctaLabel: string,
  ctaHref: string
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
      Ricevi questa email perché hai una richiesta o una conversazione attiva su BOB.
      È una comunicazione di servizio, non promozionale.
    </p>
  </div></body></html>`;
}

export type NotifyEvent =
  | "new_request"
  | "new_message"
  | "appointment_proposed"
  | "appointment_confirmed"
  | "appointment_declined";

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
  }

  return { to, subject, html: shell(subject, bodyHtml, cta, href), text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
