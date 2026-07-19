// Helper client: notifica un evento senza bloccare la UX (fire-and-forget).
// La route /api/notify risolve destinatario e contenuto lato server ed è
// dormiente finché non c'è RESEND_API_KEY.

import type { NotifyEvent } from "@/lib/email";

export function notifyEvent(
  event: NotifyEvent,
  args: { requestId: string; professionalId?: string | null; preview?: string | null }
): void {
  try {
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event,
        requestId: args.requestId,
        professionalId: args.professionalId ?? undefined,
        preview: args.preview ?? undefined,
      }),
    }).catch(() => {});
  } catch {
    // notifica non critica: si prosegue comunque
  }
}
