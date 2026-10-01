// IL COLORE DI UN ACCOUNT (01/10, Lucio).
//
// PERCHE' NON SONO TUTTI INDACO. Con due account nello stesso browser il
// cerchio con le iniziali era identico per tutti e due: stesso indaco, stessa
// forma, e l'unica differenza erano due lettere alte dodici pixel. Chi passa
// da cliente a professionista dieci volte al giorno non legge quelle due
// lettere — guarda il colore e basta, come su Gmail. Due cerchi uguali
// costringono a leggere; due cerchi diversi si riconoscono con la coda
// dell'occhio, che e' il punto di avere un avatar.
//
// IL COLORE NASCE DALL'EMAIL, NON DA UNA COLONNA. Il motivo e' che lo stesso
// colore serve anche per l'ALTRO account, di cui sappiamo solo l'email (la
// tendina mostra `altroAccount.email`, non un profilo: quell'account non e'
// quello attivo e non possiamo leggerne le righe). Una colonna sul profilo
// sarebbe leggibile solo per l'account attivo, e l'altro cerchio resterebbe
// grigio: cioe' il problema di prima, meta'. Derivandolo dall'email il colore
// esiste sempre, e' lo stesso su ogni dispositivo e non costa una migrazione.
//
// NIENTE CLASSI TAILWIND GENERATE A RUNTIME. `bg-${colore}` non funziona: il
// compilatore legge le classi nel sorgente e quelle costruite con una
// variabile non finiscono nel CSS. Qui si restituisce un colore vero, usato
// con `style`, e il problema non si pone.

/**
 * La tavolozza. Tutti leggibili con il testo bianco sopra (contrasto >= 4.5:1,
 * WCAG AA): il cerchio porta sempre due lettere bianche e un avatar che non si
 * legge non e' un avatar. Il primo e' l'indaco del marchio, cosi' chi ha un
 * account solo vede esattamente quello che vedeva prima.
 */
export const COLORI_ACCOUNT = [
  "#3730a3", // indaco (il colore di Bob)
  "#0f766e", // verde acqua
  "#9a3412", // mattone
  "#be123c", // rosso rosa
  "#7e22ce", // viola
  "#0369a1", // blu
  "#3f6212", // verde oliva
  "#a16207", // ocra
] as const;

/**
 * FNV-1a a 32 bit. Serve solo a spargere le email sulla tavolozza in modo
 * stabile: stessa email, stesso colore, oggi e fra sei mesi, su qualunque
 * dispositivo. Non e' una funzione di sicurezza e non protegge niente — l'email
 * non esce da qui, si trasforma solo in un numero.
 */
function impronta(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Il colore di un account, dal suo indirizzo. Senza email si torna all'indaco:
 * un cerchio deve comunque avere un colore, e quello di default e' il nostro.
 */
export function coloreAccount(email: string | null | undefined): string {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return COLORI_ACCOUNT[0];
  return COLORI_ACCOUNT[impronta(e) % COLORI_ACCOUNT.length];
}
