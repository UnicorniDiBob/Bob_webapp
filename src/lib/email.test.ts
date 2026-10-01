// LA POSTA E' SPENTA, E QUESTO TEST LO TIENE COSI' (01/10, Lucio).
//
// Il piano di invio ha un numero di email limitato: accenderla e' una
// decisione, non un effetto collaterale. Questo test fallisce se qualcuno
// cambia l'interruttore in src/lib/email.ts senza cambiare anche questo file
// — cioe' se succede per sbaglio. Per accenderla davvero: vedi il commento
// sopra POSTA_TRANSAZIONALE.
//
// E non basta la chiave: il test mette RESEND_API_KEY nell'ambiente, come
// sarebbe su Vercel il giorno in cui qualcuno la aggiunge, e controlla che
// non parta niente lo stesso.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POSTA_TRANSAZIONALE,
  buildEmail,
  emailEnabled,
  sendEmail,
} from "./email";

describe("la posta transazionale", () => {
  const prima = process.env.RESEND_API_KEY;
  const fetchFinto = vi.fn(async () => new Response("{}", { status: 200 }));

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_chiave_di_prova";
    vi.stubGlobal("fetch", fetchFinto);
    fetchFinto.mockClear();
  });
  afterEach(() => {
    if (prima === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prima;
    vi.unstubAllGlobals();
  });

  it("e' spenta per scelta, con l'interruttore", () => {
    expect(POSTA_TRANSAZIONALE).toBe("spenta");
  });

  it("resta spenta anche con la chiave Resend nell'ambiente", () => {
    expect(emailEnabled()).toBe(false);
  });

  it("sendEmail non chiama Resend", async () => {
    const email = buildEmail("appointment_cancelled", "pro@example.com", {
      recipientName: null,
      senderName: "Giulia",
      serviceName: "Pulizie",
      cityName: null,
      preview: "ven 2 ott, 10:00",
      link: "/messaggi",
    });
    expect(await sendEmail(email)).toBe(false);
    expect(fetchFinto).not.toHaveBeenCalled();
  });
});

describe("i testi degli avvisi di appuntamento", () => {
  const ctx = {
    recipientName: "Marco Rossi",
    senderName: "Giulia",
    serviceName: "Pulizie",
    cityName: null,
    preview: "ven 2 ott, 10:00",
    link: "/messaggi?r=x",
  };
  for (const ev of [
    "appointment_cancelled",
    "appointment_moved",
    "appointment_booked",
  ] as const) {
    it(`${ev}: oggetto, testo e link`, () => {
      const e = buildEmail(ev, "a@example.com", ctx);
      expect(e.subject.length).toBeGreaterThan(0);
      expect(e.text).toContain("Giulia");
      expect(e.text).toContain("/messaggi?r=x");
      // Una riga per cosa: nessun a capo spezzato dentro il template.
      expect(e.text.split("\n")[0]).toBe("Ciao Marco,");
    });
  }
});
