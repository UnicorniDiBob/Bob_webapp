import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { caricaNotificheAppuntamenti } from "./notificheAppuntamenti";

// Un client finto: ogni tabella risponde con le righe date. Rispetta solo
// i filtri .eq() (l'autore, il tipo, lo stato): con due letture sullo
// storico, quella dell'altra parte e quella dei miei rifiuti, ognuna deve
// vedere le sue righe come dal database. Gli altri filtri (ultimi 30 giorni,
// orari futuri) li fa il database; qui conta come una riga diventa una frase.
function finto(tabelle: Record<string, unknown[]>): SupabaseClient {
  return {
    from(tabella: string) {
      const filtri: [string, unknown][] = [];
      const b: Record<string, unknown> = {};
      for (const m of ["select", "gte", "order", "limit", "not", "gt", "in"]) {
        b[m] = () => b;
      }
      b.eq = (colonna: string, valore: unknown) => {
        filtri.push([colonna, valore]);
        return b;
      };
      b.then = (ok: (r: { data: unknown[]; error: null }) => unknown) =>
        ok({
          data: (tabelle[tabella] ?? []).filter((r) =>
            filtri.every(([c, v]) => (r as Record<string, unknown>)[c] === v)
          ),
          error: null,
        });
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

// Il pro guarda: il nome del cliente arriva dall'appuntamento.
async function perIlPro(eventi: unknown[]) {
  return caricaNotificheAppuntamenti(
    finto({ appointment_events: eventi, appointments: [] }),
    { userId: "u-pro", role: "professional" }
  );
}

// sab 10 ott 10:00 ora di Roma: il secondo spostamento chiesto dal vivo l'08/10.
const SAB_10 = "2026-10-10T08:00:00Z";

// Lo spostamento chiesto dal cliente e la risposta del pro, come li scrive
// lo storico: il cliente da {orario} a {orario chiesto}; il ripristino (118)
// 'rifiutato' da {orario chiesto} a {orario che resta}.
const chiestoDalCliente = (over: Record<string, unknown> = {}) =>
  evento({
    id: "e-sposta",
    tipo: "spostato",
    autore: "customer",
    inizio_prima: MAR_13,
    inizio_dopo: SAB_10,
    created_at: "2026-10-08T13:11:07Z",
    ...over,
  });
const rifiutoDelPro = (over: Record<string, unknown> = {}) =>
  evento({
    id: "e-rifiuto",
    tipo: "rifiutato",
    autore: "professional",
    inizio_prima: SAB_10,
    inizio_dopo: MAR_13,
    created_at: "2026-10-08T14:17:06Z",
    ...over,
  });

describe("lo spostamento chiesto dal cliente e rifiutato dal pro, nella campanella del pro", () => {
  it("dopo il rifiuto (118) il pro non vede «ha spostato»: non c'e' nessuna notizia", async () => {
    const lista = await perIlPro([chiestoDalCliente(), rifiutoDelPro()]);
    expect(lista).toEqual([]);
  });

  it("anche il rifiuto semplice (orario di prima gia' passato: prima e dopo uguali) lo nasconde", async () => {
    const lista = await perIlPro([
      chiestoDalCliente(),
      rifiutoDelPro({ inizio_prima: SAB_10, inizio_dopo: SAB_10 }),
    ]);
    expect(lista).toEqual([]);
  });

  it("uno spostamento accettato dal pro resta una notizia: «ha spostato», da… a…", async () => {
    const [n, ...altre] = await perIlPro([
      chiestoDalCliente(),
      evento({ id: "e-conferma", tipo: "confermato", autore: "professional", inizio_prima: SAB_10, inizio_dopo: SAB_10, created_at: "2026-10-08T14:17:06Z" }),
    ]);
    expect(altre).toEqual([]);
    expect(n.id).toBe("appuntamento:evento:e-sposta");
    expect(n.titolo).toBe("Gianpiero ha spostato l'appuntamento");
    expect(n.testo).toBe("Da mar 13 ott, 09:00 a sab 10 ott, 10:00 · Pulizia.");
  });

  it("un rifiuto vecchio non nasconde una richiesta nuova allo stesso orario, arrivata dopo", async () => {
    const lista = await perIlPro([
      chiestoDalCliente({ id: "e-prima", created_at: "2026-10-08T10:00:00Z" }),
      rifiutoDelPro({ created_at: "2026-10-08T11:00:00Z" }),
      chiestoDalCliente({ id: "e-dopo", created_at: "2026-10-08T12:00:00Z" }),
    ]);
    expect(lista.map((n) => n.id)).toEqual(["appuntamento:evento:e-dopo"]);
  });

  it("un rifiuto su un altro appuntamento non nasconde niente", async () => {
    const lista = await perIlPro([chiestoDalCliente(), rifiutoDelPro({ appointment_id: "a2" })]);
    expect(lista.map((n) => n.titolo)).toEqual(["Gianpiero ha spostato l'appuntamento"]);
  });

  it("il rifiuto semplice del cliente resta com'era per il pro: «non ha accettato l'orario»", async () => {
    const [n] = await perIlPro([
      evento({ tipo: "rifiutato", autore: "customer", inizio_prima: VEN_9, inizio_dopo: VEN_9 }),
    ]);
    expect(n.titolo).toBe("Gianpiero non ha accettato l'orario");
    expect(n.testo).toBe("ven 9 ott, 10:00 · Pulizia. Scrivetevi per trovarne un altro.");
  });
});

describe("lato cliente non cambia niente", () => {
  it("con le stesse righe il cliente vede il «non ha potuto spostare» della 118, e basta", async () => {
    const [n, ...altre] = await perIlCliente([chiestoDalCliente(), rifiutoDelPro()]);
    expect(altre).toEqual([]);
    expect(n.titolo).toBe("Milano Clean Squad non ha potuto spostare l'appuntamento");
    expect(n.testo).toBe("Resta mar 13 ott, 09:00 · Pulizia.");
  });

  it("il caso speculare (il cliente rifiuta lo spostamento del pro) resta com'e': rilievo a parte, non corretto qui", async () => {
    const [n] = await perIlCliente([
      evento({ id: "e-pro", tipo: "spostato", autore: "professional", inizio_prima: MAR_13, inizio_dopo: SAB_10, created_at: "2026-10-08T13:11:07Z" }),
      evento({ id: "e-no", tipo: "rifiutato", autore: "customer", inizio_prima: SAB_10, inizio_dopo: SAB_10, created_at: "2026-10-08T14:17:06Z" }),
    ]);
    expect(n.titolo).toBe("Milano Clean Squad ha spostato l'appuntamento");
    expect(n.testo).toBe("Da mar 13 ott, 09:00 a sab 10 ott, 10:00 · Pulizia.");
  });
});
