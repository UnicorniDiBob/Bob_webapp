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
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline font-sans text-2xl font-black tracking-tight text-bob-indigo ${className}`}
      aria-label="BOB"
    >
      BOB
      <span
        aria-hidden
        className="ml-0.5 inline-block h-2 w-2 translate-y-[1px] rounded-full bg-bob-yellow"
      />
    </span>
  );
}
