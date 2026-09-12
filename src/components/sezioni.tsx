/**
 * I pezzi con cui si costruisce una pagina nello stile della home.
 *
 * PERCHE' ESISTE QUESTO FILE
 *
 * Fino al 12 settembre 2026 "lo stile della home" non era uno stile: era un
 * file. Stava tutto dentro src/app/page.tsx e da nessuna parte c'era scritto
 * quali fossero le regole. Rifare le altre pagine copiando quel JSX avrebbe
 * prodotto quaranta pagine leggermente diverse fra loro — che e' esattamente
 * il difetto da cui siamo partiti.
 *
 * Qui dentro ci sono le cinque cose che la home fa e le altre pagine no:
 * fasce a tutta larghezza con sfondi alternati, titoli di sezione, passi
 * illustrati, blocchi con la riga gialla, comparsa allo scorrimento (che sta
 * in Rivela).
 *
 * COSA NON STA QUI: l'eroe della home. E' l'unico della sua specie — c'e' una
 * home sola — e farlo passare da `Fascia` avrebbe voluto dire una variante di
 * sfondo e una di spaziatura usate una volta ciascuna. Si estrae cio' che si
 * ripete; il pezzo unico resta scritto a mano dove vive.
 *
 * LE VARIANTI SONO PROPRIETA', NON CLASSI DA FUORI. Due utility Tailwind hanno
 * la stessa specificita': vince quella che nel CSS generato viene dopo, non
 * quella passata per ultima. Una `className` dal chiamante che prova a
 * cambiare lo sfondo funziona o non funziona a seconda dell'ordine del file
 * generato, cioe' per caso. Per questo lo sfondo e' una prop con un insieme
 * chiuso di valori, e per il layout interno si annida un proprio div.
 */

import type { ReactNode } from "react";
import { Rivela } from "./Rivela";

/** Lo sfondo della fascia. L'alternanza fra queste tre da' il ritmo alla pagina. */
type Sfondo = "bianca" | "tenue" | "forte";

/**
 * Su fondo scuro il testo si schiarisce, e l'occhiello passa dall'indaco al
 * giallo perche' sull'indaco pieno l'indaco non si vede.
 */
type Tinta = "scura" | "chiara";

const SFONDO: Record<Sfondo, string> = {
  bianca: "bg-white",
  tenue: "bg-bob-indigo-50/40",
  forte: "bg-bob-indigo text-white",
};

const MISURA_TITOLO = {
  normale: "max-w-[24ch]",
  stretta: "max-w-[18ch]",
} as const;

const SPAZIATURA = {
  normale: "py-16 sm:py-20",
  stretta: "py-10 sm:py-12",
} as const;

/**
 * Una fascia a tutta larghezza, col contenuto dentro `container-bob`.
 *
 * Lo sfondo attraversa tutto lo schermo, il testo resta nella colonna: e' lo
 * spazio che si riempie, non la riga di testo che si allunga.
 *
 * Per un layout interno (una griglia, due colonne) si annida un div:
 *   <Fascia sfondo="forte">
 *     <div className="grid gap-12 lg:grid-cols-2">…</div>
 *   </Fascia>
 */
export function Fascia({
  sfondo = "bianca",
  spaziatura = "normale",
  bordo = false,
  id,
  children,
}: {
  sfondo?: Sfondo;
  spaziatura?: keyof typeof SPAZIATURA;
  /** Il filo grigio in basso. Serve fra due fasce dello stesso colore. */
  bordo?: boolean;
  /** Per i link con l'ancora. Porta con se' lo scroll-margin, se no la barra fissa copre il titolo. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={[
        SFONDO[sfondo],
        SPAZIATURA[spaziatura],
        bordo ? "border-b border-black/5" : "",
        id ? "scroll-mt-24" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="container-bob">{children}</div>
    </section>
  );
}

/**
 * L'occhiello, il titolo e il sottotitolo di una sezione.
 *
 * Il titolo e' limitato in caratteri, non in pixel: una riga di testo si legge
 * male oltre i ~60 caratteri a prescindere da quanto e' largo lo schermo, e
 * `max-w-[24ch]` segue la dimensione del font invece di combatterla.
 */
export function TestaSezione({
  occhiello,
  titolo,
  sottotitolo,
  tinta = "scura",
  allineamento = "centro",
  misura = "normale",
  ritardo,
}: {
  occhiello: string;
  titolo: string;
  sottotitolo?: string;
  tinta?: Tinta;
  allineamento?: "centro" | "sinistra";
  /**
   * Quanto e' lunga la riga del titolo, in caratteri. Decide dove va a capo,
   * quindi e' una scelta di composizione: "stretta" per i titoli che devono
   * spezzarsi presto e fare blocco. Valori chiusi perche' Tailwind genera le
   * classi leggendo il sorgente: un `max-w-[${n}ch]` calcolato non esisterebbe
   * nel CSS.
   */
  misura?: keyof typeof MISURA_TITOLO;
  ritardo?: number;
}) {
  const centrato = allineamento === "centro";
  return (
    <Rivela ritardo={ritardo} className={centrato ? "text-center" : undefined}>
      <span
        className={`section-eyebrow ${tinta === "chiara" ? "text-bob-yellow" : ""}`}
      >
        {occhiello}
      </span>
      <h2
        className={[
          "mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl",
          MISURA_TITOLO[misura],
          centrato ? "mx-auto" : "",
          tinta === "chiara" ? "" : "text-bob-ink",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {titolo}
      </h2>
      {sottotitolo && (
        <p
          className={[
            "mt-4 max-w-[52ch] text-base leading-relaxed",
            centrato ? "mx-auto" : "",
            tinta === "chiara" ? "text-white/75" : "text-bob-ink/70",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {sottotitolo}
        </p>
      )}
    </Rivela>
  );
}

/**
 * Un passo illustrato: prima il disegno, poi il numero, il titolo e il testo.
 *
 * L'illustrazione sta SOPRA e non a fianco: e' la differenza fra una pagina
 * illustrata e un elenco con le icone. `children` e' una scena di SceneBob.
 */
export function Passo({
  numero,
  titolo,
  testo,
  ritardo,
  children,
}: {
  numero: string;
  titolo: string;
  testo: string;
  ritardo?: number;
  children: ReactNode;
}) {
  return (
    <Rivela ritardo={ritardo} className="text-center">
      <div className="mb-7">{children}</div>
      <span className="section-eyebrow">{numero}</span>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-bob-ink sm:text-2xl">
        {titolo}
      </h3>
      <p className="mx-auto mt-3 max-w-[34ch] text-base leading-relaxed text-bob-ink/70">
        {testo}
      </p>
    </Rivela>
  );
}

/**
 * Un'affermazione con la riga gialla a sinistra.
 *
 * E' il sostituto della scheda bianca: dice "questa e' una cosa a se'" senza
 * mettere un bordo, un'ombra e un fondo attorno a tre righe di testo. Quando
 * tutto e' una scheda, niente conta piu' di altro.
 */
export function Blocco({
  titolo,
  tinta = "scura",
  children,
}: {
  titolo: string;
  tinta?: Tinta;
  children: ReactNode;
}) {
  return (
    <div className="border-l-4 border-bob-yellow pl-6">
      <h3
        className={`text-xl font-bold tracking-tight sm:text-2xl ${
          tinta === "chiara" ? "" : "text-bob-ink"
        }`}
      >
        {titolo}
      </h3>
      <p
        className={`mt-2 max-w-[46ch] leading-relaxed ${
          tinta === "chiara" ? "text-white/75" : "text-bob-ink/70"
        }`}
      >
        {children}
      </p>
    </div>
  );
}
