/**
 * Marchio compatto: tessera indigo con la B e il puntino accent giallo.
 * Serve dove il wordmark non entra o dove serve un'icona quadrata (card di
 * login, avatar, stati vuoti). La B è centrata con flex + leading-none: senza
 * leading-none la line-height del font sposta il glifo verso il basso e il
 * risultato appare fuori asse.
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
  const dot = size === "lg" ? "h-2.5 w-2.5 right-2.5 top-2.5" : "h-2 w-2 right-2 top-2";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center bg-bob-indigo ${box} ${className}`}
      aria-label="BOB"
      role="img"
    >
      <span
        className={`font-sans font-black leading-none tracking-tight text-white ${glyph}`}
        aria-hidden
      >
        B
      </span>
      <span
        aria-hidden
        className={`absolute rounded-full bg-bob-yellow ${dot}`}
      />
    </span>
  );
}

// Wordmark BOB: maiuscolo, peso 900, con puntino accent giallo.
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
  const punto =
    dimensione === "grande"
      ? "ml-1 h-2.5 w-2.5"
      : "ml-0.5 h-2 w-2";
  return (
    <span
      className={`inline-flex items-baseline font-sans font-black tracking-tight ${corpo} ${colore} ${className}`}
      aria-label="BOB"
    >
      BOB
      <span
        aria-hidden
        className={`inline-block translate-y-[1px] rounded-full bg-bob-yellow ${punto}`}
      />
    </span>
  );
}
