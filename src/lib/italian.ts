// Concordanza grammaticale italiana per i nomi dei servizi.
//
// Il nome del servizio arriva dal catalogo (tabella `services`) e viene infilato
// dentro frasi scritte da noi: "ho bisogno di ___", "trovi ___ verificati".
// Prima della migrazione 035 l'articolo era un "un" fisso, giusto solo per i
// nomi di mestiere maschili singolari. Qui l'articolo e la desinenza degli
// aggettivi si derivano da `gender` / `is_plural` / `takes_article`.
//
// Il genere NON è derivabile dal nome (Pulizie è femminile plurale, Traslochi
// maschile plurale), quindi arriva dal DB. La forma dell'articolo, invece, è
// una regola fonetica deterministica e sta qui.

/** I campi grammaticali che `services` porta con sé (migrazione 035). */
export interface GrammaticalNoun {
  name: string;
  gender?: string | null;
  is_plural?: boolean | null;
  takes_article?: boolean | null;
}

/** Toglie i segni diacritici combinanti, così le regex lavorano su a-z. */
function stripAccents(word: string): string {
  return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Vero se la parola richiede "uno"/"gli"/"degli" invece di "un"/"i"/"dei":
 * s + consonante, z, x, y, gn, pn, ps, sc + vocale, e semivocale i/j + vocale.
 * Es. "uno sviluppo web", "uno zaino", "uno psicologo".
 */
function needsUnoForm(word: string): boolean {
  const w = stripAccents(word).toLowerCase();
  if (/^[zxy]/.test(w)) return true;
  if (/^(gn|pn|ps)/.test(w)) return true;
  if (/^s[^aeiou]/.test(w)) return true; // sviluppo, studio, scarpa
  if (/^[ij][aeiou]/.test(w)) return true; // iato, ieri
  return false;
}

function startsWithVowel(word: string): boolean {
  return /^[aeiou]/i.test(stripAccents(word));
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function isFeminine(svc: GrammaticalNoun): boolean {
  return (svc.gender ?? "m").toLowerCase() === "f";
}

/**
 * Articolo indeterminativo, o partitivo se il nome è plurale.
 * Restituisce stringa vuota quando il nome non vuole articolo
 * ("Grafica e Logo") — in quel caso chi chiama non deve aggiungere spazi.
 */
export function indefiniteArticle(svc: GrammaticalNoun): string {
  if (svc.takes_article === false) return "";
  const head = firstWord(svc.name);
  const feminine = isFeminine(svc);

  if (svc.is_plural) {
    if (feminine) return "delle";
    return needsUnoForm(head) ? "degli" : "dei";
  }
  if (feminine) return startsWithVowel(head) ? "un'" : "una";
  return needsUnoForm(head) ? "uno" : "un";
}

/**
 * Nome del servizio in minuscolo con il suo articolo, pronto da inserire dopo
 * "ho bisogno di" o "cercavi". Senza articolo restituisce solo il nome.
 * "un idraulico" · "delle pulizie" · "uno sviluppo web" · "grafica e logo"
 */
export function withArticle(svc: GrammaticalNoun): string {
  const name = svc.name.toLowerCase();
  const art = indefiniteArticle(svc);
  if (!art) return name;
  // "un'" si attacca alla parola, gli altri articoli vogliono lo spazio.
  return art.endsWith("'") ? `${art}${name}` : `${art} ${name}`;
}

/**
 * Il nome preceduto da "di", per frasi tipo "ho bisogno ___".
 * Non è `"di " + withArticle(...)`: dopo "di" il partitivo si fonde, quindi
 * "ho bisogno di delle pulizie" è sbagliato — si dice "di pulizie".
 * "di un idraulico" · "di pulizie" · "di grafica e logo"
 */
export function afterDi(svc: GrammaticalNoun): string {
  const name = svc.name.toLowerCase();
  // Plurale o nome senza articolo: "di" regge il nome da solo.
  if (svc.is_plural || svc.takes_article === false) return `di ${name}`;
  const art = indefiniteArticle(svc);
  return art.endsWith("'") ? `di ${art}${name}` : `di ${art} ${name}`;
}

// Nota: non c'è un helper per la concordanza degli aggettivi. Servirebbe per
// frasi come "trovi X verificati", ma quelle vogliono anche il NOME al plurale
// ("elettricista" → "elettricisti"), che il DB non ha. Le frasi interessate
// sono state riscritte per parlare di "professionisti": nessun aggettivo da
// concordare col nome del servizio, nessuna colonna in più da mantenere.

/**
 * Pezzi per la domanda "Non sai quale ___ fa per te?", concordati.
 * `subject` normalizza i nomi di categoria: "quale grafica e logo fa per te"
 * suona sbagliato, "quale servizio di grafica e logo" no.
 */
export function quale(svc: GrammaticalNoun): {
  quale: string;
  fa: string;
  subject: string;
} {
  const name = svc.name.toLowerCase();
  if (svc.takes_article === false) {
    return { quale: "quale", fa: "fa", subject: `servizio di ${name}` };
  }
  return svc.is_plural
    ? { quale: "quali", fa: "fanno", subject: name }
    : { quale: "quale", fa: "fa", subject: name };
}
