/**
 * Marchio compatto BOB BEE (16/10, scelta «M2» del brief
 * docs/BRIEF_logo_mascotte_bee.md): tessera indigo, B grande bianca e una B
 * piccola gialla in basso a destra, appoggiata sulla stessa riga di base della
 * grande, come BEE accanto a BOB nel wordmark. Serve dove il wordmark non entra
 * o dove serve un'icona quadrata (card di login, avatar, stati vuoti).
 *
 * La dimensione del carattere sta sulla tessera e la B piccola e' in em
 * (0.42): cosi' le due B scalano insieme e non serve una tabella per misura.
 * La B grande si sposta un po' a sinistra (-12%) per fare posto alla piccola.
 * leading-none su tutte e due: senza, la line-height del font sposta i glifi
 * verso il basso e il risultato appare fuori asse.
 *
 * PERCHE' NON «bottom: 24%» COME NEL RIFERIMENTO. Una percentuale della
 * tessera non mette la B piccola sulla riga della grande: il rapporto fra
 * tessera e carattere cambia con la misura (64/30, 48/24), e misurata nel
 * browser la piccola stava 4px sotto a 64 e 2,4px sotto a 48. La riga di base
 * della grande sta a meta' tessera + (ascendente - discendente)/2 em; con le
 * metriche di Schibsted Grotesk (2000 e 528 su 2048) la piccola ci si
 * appoggia con bottom = 50% - 0.9963em (em della piccola). Misurato: le due
 * righe coincidono entro 0,03px a 64, 48, 32 e 16.
 */
export function LogoMark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-16 w-16 rounded-[1.35rem]" : "h-12 w-12 rounded-2xl";
  const glyph = size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center bg-bob-indigo font-sans font-black leading-none tracking-tight ${glyph} ${box} ${className}`}
      aria-label="BOB BEE"
      role="img"
    >
      <span className="-translate-x-[12%] text-white" aria-hidden>
        B
      </span>
      <span
        aria-hidden
        className="absolute bottom-[calc(50%_-_0.9963em)] right-[14%] text-[0.42em] text-bob-yellow"
      >
        B
      </span>
    </span>
  );
}

// Wordmark BOB BEE (16/10, scelta «A» del brief docs/BRIEF_logo_mascotte_bee.md):
// BOB maiuscolo, peso 900, e accanto BEE in giallo Bob, peso 800, alto meno
// della meta' (0.48em) e sulla stessa riga di base. BEE prende il posto del
// puntino giallo. Tutto in em: le due misure (normale, grande) scalano da sole.
//
// La tinta e' un parametro e non una classe passata da fuori: `className` non
// puo' scavalcare `text-bob-indigo` in modo prevedibile, perche' due utility
// Tailwind hanno la stessa specificita' e vince quella che capita dopo nel CSS
// generato, non quella scritta dopo nella stringa. Sul piede scuro serviva
// bianco, e "speriamo che vinca" non e' un modo di scegliere un colore.
export function Logo({
  className = "",
  tinta = "scura",
  dimensione = "normale",
}: {
  className?: string;
  /** `scura` sui fondi chiari, `chiara` sui fondi scuri (il piede). */
  tinta?: "scura" | "chiara";
  /** `grande` nell'intestazione, dove il marchio deve pesare. */
  dimensione?: "normale" | "grande";
}) {
  const colore = tinta === "chiara" ? "text-white" : "text-bob-indigo";
  const corpo = dimensione === "grande" ? "text-3xl sm:text-[2rem]" : "text-2xl";
  // BEE fa parte del nome: role="img" con l'etichetta intera, cosi' un lettore
  // di schermo dice «BOB BEE» e non «bobbee» tutto attaccato.
  return (
    <span
      className={`inline-flex items-baseline font-sans font-black tracking-tight ${corpo} ${colore} ${className}`}
      aria-label="BOB BEE"
      role="img"
    >
      BOB
      <span className="ml-[0.12em] text-[0.48em] font-extrabold tracking-normal text-bob-yellow">BEE</span>
    </span>
  );
}
