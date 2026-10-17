import type { ReactNode } from "react";

// Il link dentro i testi congelati dei termini (17/10, Lucio).
//
// PERCHE' NON next/link. I testi si rendono anche fuori da una pagina, in una
// stringa per l'app (lib/termini/testoPerApp, route /api/termini/[versione]).
// Nel layer server di una route next/link e' un componente client, e
// renderToStaticMarkup non sa renderizzarlo: la route rispondeva 500 mentre i
// test, dove next/link e' un modulo qualunque, passavano. Un <a> semplice
// produce lo stesso HTML della pagina; si perde solo la navigazione lato
// client verso /privacy, che per un link dentro un testo legale non serve.
// className prima di href: e' l'ordine in cui li scrive next/link, cosi'
// l'HTML delle pagine resta identico byte per byte (verificato il 17/10).
export function LinkTesto({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}
