"use client";

// Un riquadro delle Analisi con i due bottoni che la spec chiede su ogni
// grafico (§7.3):
//
// COPIA NUMERI: righe separate da tabulazione, con l'intestazione, numeri
// all'italiana. Incollate in Excel o in Fogli finiscono gia' in colonne. E'
// quello che useranno di piu'.
//
// COPIA IMMAGINE: recharts disegna un SVG; lo si serializza, lo si disegna su
// un canvas al doppio della risoluzione con sotto la didascalia (periodo e
// origine dei dati: un grafico girato su WhatsApp senza didascalia diventa un
// numero falso), e il PNG va negli appunti. Safari vuole il ClipboardItem
// costruito con una PROMESSA dentro il gesto dell'utente, quindi la promessa
// si passa e non si aspetta prima. Dove gli appunti non accettano immagini,
// il PNG si scarica.

import { useRef, useState, type ReactNode } from "react";
import { ClipboardCopy, Image as ImmagineIcon } from "lucide-react";

export type Cella = string | number | null;

const numeroIt = (n: number) =>
  n.toLocaleString("it-IT", { useGrouping: false, maximumFractionDigits: 2 });

export function righeTsv(righe: Cella[][]): string {
  return righe
    .map((r) =>
      r
        .map((c) =>
          c == null ? "" : typeof c === "number" ? numeroIt(c) : c.replace(/[\t\n]/g, " ")
        )
        .join("\t")
    )
    .join("\n");
}

function pngDaSvg(svg: SVGSVGElement, didascalia: string): Promise<Blob> {
  return new Promise((risolvi, rifiuta) => {
    const box = svg.getBoundingClientRect();
    const larg = Math.max(1, Math.round(box.width));
    const alt = Math.max(1, Math.round(box.height));
    const copia = svg.cloneNode(true) as SVGSVGElement;
    copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copia.setAttribute("width", String(larg));
    copia.setAttribute("height", String(alt));
    // Il carattere della pagina non arriva dentro l'immagine se non lo si
    // dice: senza, il testo cade sul serif del sistema.
    copia.setAttribute(
      "style",
      `font-family: ${getComputedStyle(svg).fontFamily || "sans-serif"}`
    );
    const testo = new XMLSerializer().serializeToString(copia);
    const img = new Image();
    img.onload = () => {
      const scala = 2;
      const margine = 16;
      const fascia = 28;
      const canvas = document.createElement("canvas");
      canvas.width = (larg + margine * 2) * scala;
      canvas.height = (alt + margine * 2 + fascia) * scala;
      const ctx = canvas.getContext("2d");
      if (!ctx) return rifiuta(new Error("canvas"));
      ctx.scale(scala, scala);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, larg + margine * 2, alt + margine * 2 + fascia);
      ctx.drawImage(img, margine, margine, larg, alt);
      ctx.fillStyle = "#6b6990";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(didascalia, margine, alt + margine + 18);
      canvas.toBlob((b) => (b ? risolvi(b) : rifiuta(new Error("png"))), "image/png");
    };
    img.onerror = () => rifiuta(new Error("svg"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(testo)}`;
  });
}

export function GraficoCopiabile({
  titolo,
  sottotitolo,
  didascalia,
  righe,
  nomeFile,
  children,
  testId,
  immagine = true,
}: {
  titolo: string;
  sottotitolo?: ReactNode;
  /** Periodo e origine dei dati: finisce sotto l'immagine copiata. */
  didascalia: string;
  /** Le stesse cifre del grafico, intestazione compresa. */
  righe: Cella[][];
  nomeFile: string;
  children: ReactNode;
  testId?: string;
  /** false sui riquadri senza grafico: copiare un'immagine di un elenco no. */
  immagine?: boolean;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [stato, setStato] = useState<string | null>(null);

  function avvisa(s: string) {
    setStato(s);
    setTimeout(() => setStato(null), 2500);
  }

  async function copiaNumeri() {
    try {
      await navigator.clipboard.writeText(righeTsv([[titolo], [didascalia], [], ...righe]));
      avvisa("Numeri copiati: incollali in Excel");
    } catch {
      avvisa("Il browser non ha permesso di copiare");
    }
  }

  async function copiaImmagine() {
    const svg = area.current?.querySelector("svg.recharts-surface") as SVGSVGElement | null;
    if (!svg) {
      avvisa("Questo riquadro non ha un grafico da copiare");
      return;
    }
    const png = pngDaSvg(svg, `${titolo} · ${didascalia}`);
    try {
      if (typeof ClipboardItem === "undefined") throw new Error("niente ClipboardItem");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      avvisa("Immagine copiata: incollala dove vuoi");
    } catch {
      try {
        const blob = await png;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${nomeFile}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        avvisa("Il browser non copia immagini: l'ho scaricata");
      } catch {
        avvisa("L'immagine non si è potuta creare");
      }
    }
  }

  return (
    <section className="card p-5" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-bob-ink">{titolo}</h2>
          {sottotitolo && <p className="mt-1 text-sm text-bob-ink/70">{sottotitolo}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {immagine && (
            <button
              type="button"
              onClick={copiaImmagine}
              className="btn-ghost px-2.5 py-1.5 text-xs"
              title="Copia il grafico come immagine"
            >
              <ImmagineIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Copia immagine
            </button>
          )}
          <button
            type="button"
            onClick={copiaNumeri}
            className="btn-ghost px-2.5 py-1.5 text-xs"
            title="Copia i numeri per Excel"
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
            Copia numeri
          </button>
        </div>
      </div>
      {stato && (
        <p className="mt-2 text-xs font-medium text-bob-indigo" role="status">
          {stato}
        </p>
      )}
      <div ref={area} className="mt-4">
        {children}
      </div>
    </section>
  );
}
