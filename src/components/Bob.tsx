import type { ReactNode } from "react";

/**
 * Bob, la mascotte.
 *
 * Deciso il 12 settembre 2026 da André e Lucio, guardando cinque stili e
 * quattro tenute (vedi claude/MASCOT_bob_12set.md): testa grande in proporzione
 * da cartone, salopette sopra la camicia, scarponi di cuoio.
 *
 * PERCHE' UN COMPONENTE E NON DELLE IMMAGINI
 *
 * Il corpo e' disegnato una volta sola e riusato in ogni posa: due Bob non
 * possono divergere, perche' sono lo stesso codice. E' il problema che le
 * immagini generate non risolvono — la coerenza di un personaggio su dieci
 * illustrazioni diverse — e qui non si pone proprio.
 * In piu': pesa un paio di kB invece di centinaia, non fa una richiesta di
 * rete, si ricolora cambiando una costante e si anima pezzo per pezzo.
 *
 * PERCHE' LE BRACCIA STANNO FUORI DAL CORPO
 *
 * Una posa nuova e' una rotazione, non un disegno nuovo. `saluta` e `telefono`
 * sono lo stesso braccio a due angoli diversi. Quando servira' "Bob che indica"
 * o "Bob che porta una cassetta", si aggiunge un angolo, non un file.
 *
 * NIENTE <defs> + <use>
 *
 * Sarebbe piu' compatto, ma gli id dentro <defs> sono globali al documento: due
 * Bob nella stessa pagina collidono. Il corpo e' quindi JSX ripetuto nel DOM —
 * costa qualche elemento in piu' e ci fa restare un server component, senza
 * useId e senza JavaScript spedito al browser.
 *
 * IL CASCO NON SI TOGLIE
 *
 * E' l'unica forma che si riconosce quando Bob e' alto venti pixel: scheda del
 * browser, avatar della chat, icona dell'app. Il vestito si legge solo quando
 * e' grande. Se un giorno servira' un Bob senza casco, e' un personaggio
 * diverso e va discusso, non un parametro.
 */

/** I colori di Bob. Si cambiano qui e cambiano ovunque. */
const C = {
  pelle: "#e8b48c",
  tratto: "#1e1b4b",
  casco: "#fbbf24",
  cascoScuro: "#eaa50c",
  camicia: "#ffffff",
  camiciaOmbra: "#dfe3f2",
  salopette: "#3730a3",
  salopetteScura: "#2a2470",
  fibbia: "#fbbf24",
  scarpe: "#7a5230",
  suola: "#c8a179",
  capelli: "#5b4033",
} as const;

/**
 * Le pose disponibili.
 * - `neutro`   braccia lungo i fianchi. Il default, e quello che sta bene ovunque.
 * - `saluta`   braccio destro alzato. Per l'accoglienza: home, stati vuoti, onboarding.
 * - `telefono` braccio destro piegato con il telefono in mano. Per l'app e le notifiche.
 * - `indica`   braccio destro teso in avanti e un po' in alto. Per quando Bob
 *              mostra qualcosa che sta accanto a lui: una classifica, un
 *              elenco, un cartello. Aggiunta il 12 settembre 2026 — era gia'
 *              prevista qui sopra, ed e' costata un numero.
 */
export type PosaBob = "neutro" | "saluta" | "telefono" | "indica";

/** Di quanti gradi ruota il braccio destro, per posa. Il perno e' la spalla. */
const ANGOLO_BRACCIO: Record<PosaBob, number> = {
  neutro: 0,
  saluta: -135,
  telefono: -26,
  indica: -72,
};

/**
 * Da che parte e' girato.
 *
 * DI PROFILO Bob guarda a DESTRA. Serve ogni volta che deve interagire con un
 * oggetto che ha un suo verso — una cariola, una porta, una scala appoggiata:
 * un personaggio frontale accanto a un oggetto di lato sono due punti di vista
 * nella stessa immagine, e si vede. Il corpo si stringe, le gambe vanno una
 * davanti e una dietro, resta un occhio solo e spunta il naso; il casco tiene
 * la tesa piu' avanti che indietro. Il braccio visibile e' uno: quello di la'
 * non si disegna.
 *
 * DI SCHIENA NON E' UN BOB DIVERSO: e' lo stesso corpo con tre pezzi cambiati.
 * Sparisce il viso, il colletto a V diventa una scollatura dritta, e la
 * pettorina con le fibbie lascia il posto alle due bretelle incrociate — che
 * e' come sta fatta una salopette vera vista da dietro. Casco, gambe, scarponi
 * e braccia sono gli stessi: e' quello che lo tiene riconoscibile quando in
 * una stessa illustrazione qualcuno e' girato e qualcuno no.
 */
export type VersoBob = "fronte" | "schiena" | "profilo";

/**
 * Il corpo di profilo, rivolto a destra.
 *
 * Sta in una funzione sua e non in una sfilza di ternari dentro `Corpo`:
 * cambia quasi tutto — larghezza del torso, gambe sfalsate, mezza faccia,
 * tesa del casco spostata — e mescolarlo al resto avrebbe reso illeggibili
 * tutti e tre i versi.
 *
 * La testa resta un cerchio da 52 nella stessa posizione degli altri versi:
 * e' quello che lo tiene riconoscibile come lo stesso personaggio.
 */
function CorpoProfilo() {
  return (
    <>
      <ellipse cx="100" cy="252" rx="34" ry="6" fill={C.tratto} opacity="0.12" />

      {/* la gamba dietro, piu' scura per staccarla da quella davanti */}
      <rect x="83" y="206" width="17" height="32" rx="7.5" fill="#221c5e" />
      <rect x="76" y="232" width="32" height="15" rx="6" fill="#5f3f26" />
      <rect x="76" y="243" width="32" height="5" rx="2.5" fill={C.suola} opacity="0.7" />

      {/* la gamba davanti, col piede piu' lungo: e' quello che da' il verso */}
      <rect x="101" y="206" width="17" height="32" rx="7.5" fill={C.salopetteScura} />
      <rect x="96" y="232" width="37" height="15" rx="6" fill={C.scarpe} />
      <rect x="96" y="243" width="37" height="5" rx="2.5" fill={C.suola} />

      {/* il torso, stretto: di lato si vede una spalla sola */}
      <rect x="74" y="152" width="57" height="62" rx="15" fill={C.camicia} />

      {/* la salopette: il fondo, la pettorina vista di taglio, una bretella */}
      <rect x="74" y="186" width="57" height="28" rx="13" fill={C.salopette} />
      <rect x="110" y="158" width="21" height="30" rx="4" fill={C.salopette} />
      <rect x="108" y="146" width="9" height="20" rx="4.5" fill={C.salopette} transform="rotate(7 112 156)" />
      <rect x="109" y="160" width="10" height="6" rx="2" fill={C.fibbia} />

      {/* la testa: i capelli sulla nuca spuntano da sinistra, il naso a destra */}
      <circle cx="92" cy="92" r="52" fill={C.capelli} />
      <circle cx="100" cy="92" r="52" fill={C.pelle} />
      <circle cx="152" cy="103" r="7" fill={C.pelle} />

      {/* il casco: stessa cupola, tesa spostata in avanti */}
      <path d="M46 82c0-30 24-54 54-54s54 24 54 54z" fill={C.casco} />
      <rect x="50" y="77" width="128" height="15" rx="7.5" fill={C.cascoScuro} />
      <rect x="93" y="34" width="14" height="44" rx="7" fill={C.cascoScuro} />

      {/* mezza faccia: un occhio, una bocca corta */}
      <circle cx="127" cy="97" r="6.2" fill={C.tratto} />
      <circle cx="129.5" cy="94.5" r="2" fill="#ffffff" />
      <path d="M124 115c5 6 14 5 19-1" stroke={C.tratto} strokeWidth="4.6" strokeLinecap="round" fill="none" />
    </>
  );
}

function Corpo({ verso }: { verso: VersoBob }) {
  if (verso === "profilo") return <CorpoProfilo />;
  return (
    <>
      <ellipse cx="100" cy="252" rx="42" ry="7" fill={C.tratto} opacity="0.12" />

      {/* gambe e scarponi */}
      <rect x="82" y="206" width="15" height="32" rx="7" fill={C.salopetteScura} />
      <rect x="103" y="206" width="15" height="32" rx="7" fill={C.salopetteScura} />
      <rect x="74" y="232" width="29" height="15" rx="6" fill={C.scarpe} />
      <rect x="97" y="232" width="29" height="15" rx="6" fill={C.scarpe} />
      <rect x="74" y="243" width="29" height="5" rx="2.5" fill={C.suola} />
      <rect x="97" y="243" width="29" height="5" rx="2.5" fill={C.suola} />

      {/* camicia */}
      <rect x="66" y="152" width="68" height="62" rx="15" fill={C.camicia} />
      {verso === "fronte" ? (
        <path d="M88 152l12 13 12-13z" fill={C.camiciaOmbra} />
      ) : (
        <rect x="86" y="151" width="28" height="7" rx="3.5" fill={C.camiciaOmbra} />
      )}

      {/* salopette: parte bassa, pettorina, bretelle, fibbie, tasca */}
      <path d="M66 186h68v13c0 8-7 15-15 15H81c-8 0-15-7-15-15z" fill={C.salopette} />
      {verso === "fronte" ? (
        <>
          <rect x="81" y="161" width="38" height="28" rx="5" fill={C.salopette} />
          <rect x="75" y="149" width="9" height="20" rx="4.5" fill={C.salopette} transform="rotate(-9 79 159)" />
          <rect x="116" y="149" width="9" height="20" rx="4.5" fill={C.salopette} transform="rotate(9 120 159)" />
          <rect x="75" y="162" width="10" height="6" rx="2" fill={C.fibbia} />
          <rect x="115" y="162" width="10" height="6" rx="2" fill={C.fibbia} />
          <rect x="89" y="169" width="22" height="15" rx="3" fill={C.salopetteScura} />
        </>
      ) : (
        <>
          <path d="M80 189 118 153" stroke={C.salopette} strokeWidth="9" strokeLinecap="round" />
          <path d="M120 189 82 153" stroke={C.salopette} strokeWidth="9" strokeLinecap="round" />
        </>
      )}

      {/* testa, casco, viso */}
      {/* Di schiena la testa e' nuca, non faccia: sotto la tesa del casco si
          vedono i capelli, e ai lati le orecchie. Un cerchio di pelle vuoto
          sembrava un viso cancellato. */}
      <circle cx="100" cy="92" r="52" fill={verso === "fronte" ? C.pelle : C.capelli} />
      {verso === "schiena" && (
        <>
          <circle cx="50" cy="101" r="9" fill={C.pelle} />
          <circle cx="150" cy="101" r="9" fill={C.pelle} />
        </>
      )}
      <path d="M46 82c0-30 24-54 54-54s54 24 54 54z" fill={C.casco} />
      <rect x="36" y="77" width="128" height="15" rx="7.5" fill={C.cascoScuro} />
      <rect x="93" y="34" width="14" height="44" rx="7" fill={C.cascoScuro} />
      {verso === "fronte" && (
        <>
          <circle cx="83" cy="97" r="6.2" fill={C.tratto} />
          <circle cx="117" cy="97" r="6.2" fill={C.tratto} />
          <circle cx="85.5" cy="94.5" r="2" fill="#ffffff" />
          <circle cx="119.5" cy="94.5" r="2" fill="#ffffff" />
          <path d="M84 116c6 8 26 8 32 0" stroke={C.tratto} strokeWidth="4.6" strokeLinecap="round" fill="none" />
        </>
      )}
    </>
  );
}

/**
 * Le braccia. Il perno e' la spalla: (64.5, 162) a sinistra, (135.5, 162) a
 * destra.
 *
 * `attrezzo` sta DENTRO il gruppo che ruota, e PRIMA dei pezzi del braccio.
 * Dentro, perche' disegnato fuori resterebbe fermo mentre il braccio si muove
 * — e allora non e' in mano, e' li' accanto. Prima, perche' cosi' la mano gli
 * finisce sopra e sembra impugnato: lo stesso motivo per cui in BobConElenco
 * il telefono e' disegnato prima di Bob.
 */
function BraccioSinistro({
  gradi = 0,
  attrezzo,
}: {
  gradi?: number;
  attrezzo?: ReactNode;
}) {
  return (
    <g transform={gradi ? `rotate(${gradi} 64.5 162)` : undefined}>
      {attrezzo}
      <rect x="57" y="158" width="15" height="32" rx="7.5" fill={C.camicia} />
      <rect x="58" y="184" width="13" height="20" rx="6.5" fill={C.pelle} />
      <circle cx="64.5" cy="206" r="9" fill={C.pelle} />
    </g>
  );
}

function BraccioDestro({
  gradi,
  attrezzo,
}: {
  gradi: number;
  attrezzo?: ReactNode;
}) {
  return (
    <g transform={gradi ? `rotate(${gradi} 135.5 162)` : undefined}>
      {attrezzo}
      <rect x="128" y="158" width="15" height="32" rx="7.5" fill={C.camicia} />
      <rect x="129" y="184" width="13" height="20" rx="6.5" fill={C.pelle} />
      <circle cx="135.5" cy="206" r="9" fill={C.pelle} />
    </g>
  );
}

/** Il telefono della posa `telefono`. Sta sotto il braccio, cosi' la mano lo copre. */
function Telefono() {
  return (
    <g transform="rotate(12 148 201)">
      <rect x="126" y="168" width="44" height="66" rx="10" fill={C.tratto} />
      <rect x="132" y="175" width="32" height="52" rx="6" fill="#ffffff" />
    </g>
  );
}

export function Bob({
  posa = "neutro",
  verso = "fronte",
  alt,
  className = "",
  gradiBraccioDestro,
  gradiBraccioSinistro,
  attrezzoDestro,
  attrezzoSinistro,
  fuoriBordo = false,
}: {
  posa?: PosaBob;
  /** Di fronte o di schiena. Vedi VersoBob. */
  verso?: VersoBob;
  /**
   * Cosa sta facendo Bob, per chi non vede l'immagine.
   * Se non lo passi Bob e' decorativo e viene nascosto agli screen reader: e'
   * la scelta giusta quando accanto c'e' gia' un testo che dice la stessa cosa.
   */
  alt?: string;
  className?: string;
  /**
   * Forza l'angolo del braccio destro, scavalcando quello della posa.
   * Serve a chi anima Bob fotogramma per fotogramma — vedi BobCheSaluta.
   */
  gradiBraccioDestro?: number;
  /** Angolo del braccio sinistro. Nessuna posa lo muove: va chiesto. */
  gradiBraccioSinistro?: number;
  /** Cosa tiene nella mano destra. Ruota col braccio. */
  attrezzoDestro?: ReactNode;
  /** Cosa tiene nella mano sinistra. Ruota col braccio. */
  attrezzoSinistro?: ReactNode;
  /**
   * Lascia disegnare fuori dal viewBox.
   *
   * Un <svg> ritaglia al proprio viewport: e' il comportamento predefinito del
   * browser, non una scelta. Un attrezzo in mano a un braccio molto ruotato
   * esce da 0 o da 200 e viene tagliato di netto a meta' — si vede benissimo,
   * e sembra un errore di disegno perche' lo e'.
   *
   * Non e' acceso di default perche' cambia cosa puo' invadere lo spazio
   * attorno a Bob: lo chiede chi sa di avere qualcosa che sporge, e sa che li'
   * attorno c'e' posto.
   */
  fuoriBordo?: boolean;
}) {
  const accessibilita = alt
    ? { role: "img" as const, "aria-label": alt }
    : { "aria-hidden": true as const };

  return (
    <svg
      viewBox="0 0 200 265"
      className={className}
      style={fuoriBordo ? { overflow: "visible" } : undefined}
      {...accessibilita}
    >
      <Corpo verso={verso} />
      {/* Di profilo il braccio lontano non si disegna, e quello vicino si
          sposta al centro del torso stretto: il suo perno nasce a 135,5 che
          di lato sarebbe fuori dal corpo. Ventisei unita' a sinistra e la
          spalla torna dove sta la spalla, appena avanti rispetto al centro. */}
      {verso !== "profilo" && (
        <BraccioSinistro gradi={gradiBraccioSinistro} attrezzo={attrezzoSinistro} />
      )}
      {posa === "telefono" && <Telefono />}
      <g transform={verso === "profilo" ? "translate(-26 0)" : undefined}>
        <BraccioDestro
          gradi={gradiBraccioDestro ?? ANGOLO_BRACCIO[posa]}
          attrezzo={attrezzoDestro}
        />
      </g>
    </svg>
  );
}
