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
} as const;

/**
 * Le pose disponibili.
 * - `neutro`   braccia lungo i fianchi. Il default, e quello che sta bene ovunque.
 * - `saluta`   braccio destro alzato. Per l'accoglienza: home, stati vuoti, onboarding.
 * - `telefono` braccio destro piegato con il telefono in mano. Per l'app e le notifiche.
 */
export type PosaBob = "neutro" | "saluta" | "telefono";

/** Di quanti gradi ruota il braccio destro, per posa. Il perno e' la spalla. */
const ANGOLO_BRACCIO: Record<PosaBob, number> = {
  neutro: 0,
  saluta: -135,
  telefono: -26,
};

function Corpo() {
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
      <path d="M88 152l12 13 12-13z" fill={C.camiciaOmbra} />

      {/* salopette: parte bassa, pettorina, bretelle, fibbie, tasca */}
      <path d="M66 186h68v13c0 8-7 15-15 15H81c-8 0-15-7-15-15z" fill={C.salopette} />
      <rect x="81" y="161" width="38" height="28" rx="5" fill={C.salopette} />
      <rect x="75" y="149" width="9" height="20" rx="4.5" fill={C.salopette} transform="rotate(-9 79 159)" />
      <rect x="116" y="149" width="9" height="20" rx="4.5" fill={C.salopette} transform="rotate(9 120 159)" />
      <rect x="75" y="162" width="10" height="6" rx="2" fill={C.fibbia} />
      <rect x="115" y="162" width="10" height="6" rx="2" fill={C.fibbia} />
      <rect x="89" y="169" width="22" height="15" rx="3" fill={C.salopetteScura} />

      {/* testa, casco, viso */}
      <circle cx="100" cy="92" r="52" fill={C.pelle} />
      <path d="M46 82c0-30 24-54 54-54s54 24 54 54z" fill={C.casco} />
      <rect x="36" y="77" width="128" height="15" rx="7.5" fill={C.cascoScuro} />
      <rect x="93" y="34" width="14" height="44" rx="7" fill={C.cascoScuro} />
      <circle cx="83" cy="97" r="6.2" fill={C.tratto} />
      <circle cx="117" cy="97" r="6.2" fill={C.tratto} />
      <circle cx="85.5" cy="94.5" r="2" fill="#ffffff" />
      <circle cx="119.5" cy="94.5" r="2" fill="#ffffff" />
      <path d="M84 116c6 8 26 8 32 0" stroke={C.tratto} strokeWidth="4.6" strokeLinecap="round" fill="none" />
    </>
  );
}

function BraccioSinistro() {
  return (
    <>
      <rect x="57" y="158" width="15" height="32" rx="7.5" fill={C.camicia} />
      <rect x="58" y="184" width="13" height="20" rx="6.5" fill={C.pelle} />
      <circle cx="64.5" cy="206" r="9" fill={C.pelle} />
    </>
  );
}

function BraccioDestro({ gradi }: { gradi: number }) {
  return (
    <g transform={gradi ? `rotate(${gradi} 135.5 162)` : undefined}>
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
  alt,
  className = "",
}: {
  posa?: PosaBob;
  /**
   * Cosa sta facendo Bob, per chi non vede l'immagine.
   * Se non lo passi Bob e' decorativo e viene nascosto agli screen reader: e'
   * la scelta giusta quando accanto c'e' gia' un testo che dice la stessa cosa.
   */
  alt?: string;
  className?: string;
}) {
  const accessibilita = alt
    ? { role: "img" as const, "aria-label": alt }
    : { "aria-hidden": true as const };

  return (
    <svg viewBox="0 0 200 265" className={className} {...accessibilita}>
      <Corpo />
      <BraccioSinistro />
      {posa === "telefono" && <Telefono />}
      <BraccioDestro gradi={ANGOLO_BRACCIO[posa]} />
    </svg>
  );
}
