import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { caricaNotificheAppuntamenti } from "./notificheAppuntamenti";

// Un client finto: ogni tabella risponde con le righe date, qualunque filtro
// si chieda. I filtri veri (autore dell'altra parte, ultimi 30 giorni) li
// fa il database; qui conta come una riga dello storico diventa una frase.
function finto(tabelle: Record<string, unknown[]>): SupabaseClient {
  return {
    from(tabella: string) {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gte", "order", "limit", "not", "gt", "in"]) {
        b[m] = () => b;
      }
      b.then = (ok: (r: { data: unknown[]; error: null }) => unknown) =>
        ok({ data: tabelle[tabella] ?? [], error: null });
      return b;
    },
  } as unknown as SupabaseClient;
}

const evento = (over: Record<string, unknown>) => ({
  id: "e1",
  appointment_id: "a1",
  request_id: "r1",
  professional_id: "p1",
  autore: "professional",
  inizio_prima: null,
  inizio_dopo: null,
  motivo: null,
  concordato_telefono: false,
  created_at: "2026-10-08T09:14:44Z",
  appointments: { title: "Pulizia", customer_name: "Gianpiero" },
  ...over,
});

// Il cliente guarda: il nome del pro arriva da professionals + profiles.
async function perIlCliente(eventi: unknown[]) {
  return caricaNotificheAppuntamenti(
    finto({
      appointment_events: eventi,
      appointments: [],
      professionals: [{ id: "p1", user_id: "u-pro" }],
      profiles: [{ user_id: "u-pro", full_name: "Milano Clean Squad" }],
    }),
    { userId: "u-cliente", role: "customer" }
  );
}

// ven 9 ott 10:00 e mar 13 ott 09:00, ora di Roma: il caso dal vivo dell'08/10.
const VEN_9 = "2026-10-09T08:00:00Z";
const MAR_13 = "2026-10-13T07:00:00Z";

describe("il rifiuto di uno spostamento in campanella (118)", () => {
  it("il pro rifiuta lo spostamento: «non ha potuto spostare», resta l'orario di prima", async () => {
    const [n, ...altre] = await perIlCliente([
      evento({ tipo: "rifiutato", inizio_prima: VEN_9, inizio_dopo: MAR_13 }),
    ]);
    expect(altre).toEqual([]);
    expect(n.titolo).toBe("Milano Clean Squad non ha potuto spostare l'appuntamento");
    expect(n.testo).toBe("Resta mar 13 ott, 09:00 · Pulizia.");
    expect(`${n.titolo} ${n.testo}`).not.toContain("ha spostato");
  });

  it("un rifiuto qualunque (stesso orario prima e dopo) resta com'era", async () => {
    const [n] = await perIlCliente([
      evento({ tipo: "rifiutato", inizio_prima: VEN_9, inizio_dopo: VEN_9 }),
    ]);
    expect(n.titolo).toBe("Milano Clean Squad non ha accettato l'orario");
    expect(n.testo).toBe("ven 9 ott, 10:00 · Pulizia. Scrivetevi per trovarne un altro.");
  });

  it("uno spostamento vero del pro resta «ha spostato», da… a…", async () => {
    const [n] = await perIlCliente([
      evento({ tipo: "spostato", inizio_prima: MAR_13, inizio_dopo: VEN_9 }),
    ]);
    expect(n.titolo).toBe("Milano Clean Squad ha spostato l'appuntamento");
    expect(n.testo).toBe("Da mar 13 ott, 09:00 a ven 9 ott, 10:00 · Pulizia.");
  });
});
