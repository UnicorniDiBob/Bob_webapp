"use client";

// IL GIRO GUIDATO, ANCORATO ALLE COSE VERE.
//
// PERCHE' E' STATO RIFATTO (29/08). La prima versione della guida disegnava
// finti riquadri: rettangoli grigi che assomigliavano vagamente a una richiesta,
// a una mappa, a un calendario. Erano disegni, non il prodotto. Chi li guardava
// non imparava dove stanno le cose, perche' le cose non erano quelle: nessun
// riferimento a un punto dello schermo, nessun modo di collegare la frase a
// cio' che si vede dopo aver chiuso.
//
// COME FUNZIONA ADESSO. Ogni passo punta a un elemento vero della pagina con
// data-tour="qualcosa". Il giro lo cerca, ci porta sopra, lo ritaglia
// nell'ombra (il buco e' la pagina vera, non un'immagine) e ci scrive accanto
// la spiegazione. Se un elemento non c'e' — succede: la rotella delle
// impostazioni su telefono sta nel menu, non nella barra — il passo non mente
// e non punta a caso: niente ritaglio, pannello al centro, e il testo
// alternativo del passo, se il passo ne ha uno.
//
// REGOLE CHE NON VANNO PERSE:
// - durante il giro i click sul resto della pagina sono bloccati: un click
//   distratto porterebbe via a meta' strada. La navigazione avviene solo dai
//   link scritti dentro il pannello.
// - il ritaglio si rimisura a ogni scroll, a ogni resize e tre volte dopo il
//   cambio di passo, perche' lo scorrimento e' animato e la misura presa
//   subito sarebbe quella di prima.
// - Esc chiude, frecce destra/sinistra navigano, i pallini sono cliccabili.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export interface PassoTour {
  id: string;
  /** Valore di data-tour dell'elemento vero da illuminare. */
  ancora?: string;
  titolo: string;
  testo: string;
  /** Testo da usare quando l'ancora non e' in pagina (es. su telefono). */
  testoSenzaAncora?: string;
  /** L'elemento sta in una barra sticky o e' flottante: non si scrolla. */
  fisso?: boolean;
  /** Contenuto extra dentro il pannello (una checklist, un riepilogo). */
  contenuto?: ReactNode;
  /**
   * Il passo non si limita a spiegare: manda a fare la cosa. Quando c'e', il
   * bottone principale porta li' e il giro si sospende, per riprendere al
   * ritorno. «Piu' tardi» resta sempre accanto: un giro che obbliga non
   * accompagna, spinge.
   */
  azione?: { etichetta: string; href: string };
}

interface Riquadro {
  top: number;
  left: number;
  width: number;
  height: number;
}

const ALONE = 8;
const LARGHEZZA = 360;

function trova(ancora?: string): HTMLElement | null {
  if (!ancora || typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-tour="${ancora}"]`);
}

export function TourAncorato({
  passi,
  etichettaFine = "Ho capito",
  occupato = false,
  indiceIniziale = 0,
  onAzione,
  onEsci,
}: {
  passi: PassoTour[];
  etichettaFine?: string;
  occupato?: boolean;
  /** Da dove ripartire: al ritorno da una pagina non si rifa' il giro da capo. */
  indiceIniziale?: number;
  /** Chiamato quando si clicca l'azione di un passo. */
  onAzione?: (href: string) => void;
  /** true = segna il giro come visto. */
  onEsci: (segnaComeVisto: boolean) => void;
}) {
  const [i, setI] = useState(() =>
    Math.min(Math.max(indiceIniziale, 0), Math.max(passi.length - 1, 0))
  );
  const [riquadro, setRiquadro] = useState<Riquadro | null>(null);
  const [stretto, setStretto] = useState(false);
  const finestra = useRef({ w: 1024, h: 768 });
  const pannello = useRef<HTMLDivElement>(null);

  const passo = passi[i];
  const ultimo = i === passi.length - 1;

  const misura = useCallback(() => {
    if (typeof window === "undefined") return;
    finestra.current = { w: window.innerWidth, h: window.innerHeight };
    setStretto(window.innerWidth < 640);
    const el = trova(passo?.ancora);
    if (!el) {
      setRiquadro(null);
      return;
    }
    const r = el.getBoundingClientRect();
    // Elemento presente ma non renderizzato (display:none su un breakpoint):
    // vale come assente, altrimenti si illumina un punto di zero pixel.
    if (r.width < 4 || r.height < 4) {
      setRiquadro(null);
      return;
    }
    setRiquadro({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [passo]);

  // Cambio di passo: si porta l'elemento in vista, poi si misura piu' volte
  // perche' lo scorrimento e' animato.
  useEffect(() => {
    const el = trova(passo?.ancora);
    if (el && !passo?.fisso) {
      const r = el.getBoundingClientRect();
      const alto = window.innerWidth < 640 ? 84 : Math.max(96, (window.innerHeight - r.height) / 2);
      window.scrollTo({
        top: Math.max(0, window.scrollY + r.top - alto),
        behavior: "smooth",
      });
    }
    misura();
    const t = [120, 340, 700].map((ms) => window.setTimeout(misura, ms));
    pannello.current?.focus();
    return () => t.forEach((id) => window.clearTimeout(id));
  }, [i, misura, passo]);

  useEffect(() => {
    const f = () => misura();
    window.addEventListener("scroll", f, { passive: true });
    window.addEventListener("resize", f);
    return () => {
      window.removeEventListener("scroll", f);
      window.removeEventListener("resize", f);
    };
  }, [misura]);

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEsci(true);
      if (e.key === "ArrowRight") setI((p) => Math.min(p + 1, passi.length - 1));
      if (e.key === "ArrowLeft") setI((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [onEsci, passi.length]);

  // Posizione del pannello: sotto l'elemento se c'e' spazio, sopra se non ce
  // n'e', in basso a destra se l'elemento e' cosi' grande da non lasciarne.
  function posizione(): React.CSSProperties {
    if (!riquadro) return {};
    const { w, h } = finestra.current;
    const sinistra = Math.min(
      Math.max(riquadro.left + riquadro.width / 2 - LARGHEZZA / 2, 16),
      Math.max(16, w - LARGHEZZA - 16)
    );
    const sotto = riquadro.top + riquadro.height + ALONE + 14;
    if (h - sotto > 250) return { top: sotto, left: sinistra, width: LARGHEZZA };
    if (riquadro.top > 250)
      return { bottom: h - riquadro.top + ALONE + 14, left: sinistra, width: LARGHEZZA };
    return { bottom: 24, left: sinistra, width: LARGHEZZA };
  }

  if (!passo) return null;

  const testo = !riquadro && passo.testoSenzaAncora ? passo.testoSenzaAncora : passo.testo;

  return (
    <div className="fixed inset-0 z-50">
      {/* Blocca i click sul resto della pagina per tutta la durata del giro. */}
      <div className="absolute inset-0" aria-hidden="true" />

      {riquadro ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-bob-indigo transition-all duration-300"
          style={{
            top: riquadro.top - ALONE,
            left: riquadro.left - ALONE,
            width: riquadro.width + ALONE * 2,
            height: riquadro.height + ALONE * 2,
            boxShadow: "0 0 0 9999px rgba(15,15,25,0.55)",
          }}
          aria-hidden="true"
          data-testid="tour-ritaglio"
        />
      ) : (
        <div
          className="pointer-events-none fixed inset-0"
          style={{ background: "rgba(15,15,25,0.55)" }}
          aria-hidden="true"
        />
      )}

      <div
        ref={pannello}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-titolo"
        data-testid="tour-pannello"
        className={
          stretto
            ? "fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-black/10 bg-white p-5 shadow-2xl outline-none"
            : "fixed rounded-2xl border border-black/10 bg-white p-5 shadow-2xl outline-none transition-all duration-300"
        }
        style={stretto ? undefined : posizione()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-bob-ink/40">
              {ultimo ? "Ultimo passo" : `Passo ${i + 1} di ${passi.length}`}
            </p>
            <div className="mt-2 flex gap-1.5">
              {passi.map((p, n) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setI(n)}
                  aria-label={`Vai al passo ${n + 1}: ${p.titolo}`}
                  aria-current={n === i ? "step" : undefined}
                  className={`h-1.5 rounded-full transition-all ${
                    n === i
                      ? "w-6 bg-bob-indigo"
                      : n < i
                        ? "w-1.5 bg-bob-indigo/40 hover:bg-bob-indigo"
                        : "w-1.5 bg-black/10 hover:bg-bob-indigo/40"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEsci(true)}
            className="-mr-1 -mt-1 rounded-lg p-1 text-bob-ink/40 transition hover:bg-black/5 hover:text-bob-ink"
            aria-label="Chiudi la guida"
            data-testid="button-chiudi-guida"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <h2 id="tour-titolo" className="text-base font-bold text-bob-ink sm:text-lg">
          {passo.titolo}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/65">{testo}</p>
        {passo.contenuto && <div className="mt-3">{passo.contenuto}</div>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (i === 0 ? onEsci(true) : setI(i - 1))}
            className="text-sm font-medium text-bob-ink/50 transition hover:text-bob-ink"
            data-testid="button-indietro-guida"
          >
            {i === 0 ? "Salta" : "Indietro"}
          </button>
          <div className="flex items-center gap-3">
            {passo.azione && (
              <button
                type="button"
                onClick={() => (ultimo ? onEsci(true) : setI(i + 1))}
                className="text-sm font-medium text-bob-ink/50 transition hover:text-bob-ink"
                data-testid="button-piu-tardi-guida"
              >
                Più tardi
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (passo.azione) {
                  onAzione?.(passo.azione.href);
                  return;
                }
                if (ultimo) onEsci(true);
                else setI(i + 1);
              }}
              disabled={occupato}
              className="btn-primary disabled:opacity-50"
              data-testid="button-avanti-guida"
            >
              {passo.azione
                ? passo.azione.etichetta
                : ultimo
                  ? occupato
                    ? "Un attimo…"
                    : etichettaFine
                  : "Avanti"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
