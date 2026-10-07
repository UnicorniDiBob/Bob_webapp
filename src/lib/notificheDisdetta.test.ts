import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// notifiche.ts e' un modulo client che importa il resto dell'app: qui serve
// solo l'ordine, e i moduli che toccano Supabase o il browser si spengono.
vi.mock("@/lib/avvisi", () => ({ leggiAvvisiInCorso: vi.fn() }));
vi.mock("@/lib/notificheAppuntamenti", () => ({ caricaNotificheAppuntamenti: vi.fn() }));

import { ordina, type Notifica } from "./notifiche";
import { NotificaVoce } from "@/components/NotificaVoce";

const adesso = Date.now();
const fa = (giorni: number) => new Date(adesso - giorni * 86_400_000).toISOString();

const disdetta = (id: string, quando: string): Notifica => ({
  id,
  livello: "avviso",
  titolo: "Marco Rossi ha annullato l'appuntamento",
  testo: "Era ven 9 ott, 10:00 · Perdita.",
  href: "/messaggi?r=r1&p=p1",
  azione: "Apri la conversazione",
  quando,
  mittente: "Marco Rossi",
  disdetta: {
    orario: "ven 9 ott, 10:00 · Perdita",
    chi: "Marco Rossi",
    motivo: "Sono malato",
    concordatoTelefono: false,
  },
});

const daFare: Notifica = {
  id: "verifica",
  livello: "azione",
  titolo: "Verifica la partita IVA",
  testo: "…",
  quando: null,
};

describe("la disdetta in evidenza (07/10)", () => {
  it("una disdetta recente sta sopra anche alle cose da fare", () => {
    const x = ordina([daFare, disdetta("d1", fa(1))]);
    expect(x.map((n) => n.id)).toEqual(["d1", "verifica"]);
  });

  it("dopo una settimana torna al suo posto fra le notizie", () => {
    const x = ordina([disdetta("d1", fa(9)), daFare]);
    expect(x.map((n) => n.id)).toEqual(["verifica", "d1"]);
  });

  it("si disegna con l'orario barrato, chi, il motivo e la conversazione", () => {
    const html = renderToStaticMarkup(
      createElement(NotificaVoce, { n: disdetta("d1", fa(0)), nuova: true })
    );
    expect(html).toContain('data-testid="notifica-disdetta"');
    expect(html).toMatch(/line-through[^>]*>ven 9 ott, 10:00 · Perdita</);
    expect(html).toContain("Annullato da Marco Rossi");
    expect(html).toContain("Motivo: «Sono malato»");
    expect(html).toContain('href="/messaggi?r=r1&amp;p=p1"');
  });

  it("una notizia qualunque resta una riga normale", () => {
    const { disdetta: _d, ...normale } = disdetta("n1", fa(0));
    void _d;
    const html = renderToStaticMarkup(createElement(NotificaVoce, { n: normale, nuova: false }));
    expect(html).not.toContain("notifica-disdetta");
  });
});
