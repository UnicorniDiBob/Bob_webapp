// Percorso relativo e non l'alias "@/": Vitest non risolve l'alias di Next, e
// una prova che non gira è una prova che non c'è.
import dati from "./data/comuni-italia.json";

/**
 * I comuni italiani con CAP e coordinate. SOLO LATO SERVER.
 *
 * Il file JSON pesa 900 KB e non va importato da un componente del browser:
 * chi ha bisogno di cercare un comune passa da /api/geo/comuni. Lo genera
 * scripts/build_comuni_cap.py — comuni e codici ISTAT dall'archivio ISTAT
 * (CC BY 3.0 IT, attribuzione dovuta), CAP da una raccolta che non dichiara
 * licenza e che quindi vale come suggerimento, non come verità (decisione del
 * 17/09/2026, docs/NOTE_E_DECISIONI.md).
 */

interface ComuneGrezzo {
  i: string;
  n: string;
  s: string;
  p: string;
  r: string;
  c: string[];
  lat?: number;
  lng?: number;
}

export interface Comune {
  /** Codice ISTAT a sei cifre: la chiave stabile, il nome no. */
  istat: string;
  nome: string;
  /** Sigla della provincia (MI, TO, …). */
  sigla: string;
  provincia: string;
  regione: string;
  /** I CAP del comune, in ordine. Milano ne ha 42, Sesto San Giovanni uno. */
  cap: string[];
  lat: number | null;
  lng: number | null;
}

const GREZZI = (dati as { comuni: ComuneGrezzo[]; regioni: string[] }).comuni;
const REGIONI = (dati as { comuni: ComuneGrezzo[]; regioni: string[] }).regioni;

function vesti(c: ComuneGrezzo): Comune {
  return {
    istat: c.i,
    nome: c.n,
    sigla: c.s,
    provincia: c.p,
    regione: c.r,
    cap: c.c,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
  };
}

/** Senza accenti e in minuscolo: chi cerca «Forli» deve trovare «Forlì». */
function piatto(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const PER_ISTAT = new Map(GREZZI.map((c) => [c.i, c]));
const PIATTI = GREZZI.map((c) => piatto(c.n));

export function regioni(): string[] {
  return REGIONI;
}

export function comunePerIstat(istat: string): Comune | null {
  const c = PER_ISTAT.get(istat.trim());
  return c ? vesti(c) : null;
}

export function comuniPerCap(cap: string): Comune[] {
  const pulito = cap.trim();
  if (!/^[0-9]{5}$/.test(pulito)) return [];
  return GREZZI.filter((c) => c.c.includes(pulito))
    .slice(0, 20)
    .map(vesti);
}

/**
 * Cerca per nome. Chi inizia con quello che hai scritto viene prima di chi lo
 * contiene e basta: digitando «mila» il primo risultato dev'essere Milano, non
 * Borgo San Giacomo di Milanesi.
 */
export function cercaComuni(
  q: string,
  opzioni: { regione?: string; limite?: number } = {}
): Comune[] {
  const limite = opzioni.limite ?? 20;
  const regione = opzioni.regione ? piatto(opzioni.regione) : "";
  const cerca = piatto(q);

  // Si scorre tutto l'elenco: 7.904 confronti sono microsecondi, e fermarsi al
  // ventesimo che INIZIA per quelle lettere faceva sparire chi le ha in mezzo
  // — «Sesto San Giovanni» dietro a trenta «San Giovanni …».
  const esatti: ComuneGrezzo[] = [];
  const inizia: ComuneGrezzo[] = [];
  const contiene: ComuneGrezzo[] = [];

  for (let i = 0; i < GREZZI.length; i++) {
    const c = GREZZI[i];
    if (regione && piatto(c.r) !== regione) continue;
    if (!cerca) {
      // Nessuna parola: è l'elenco di una regione, e si taglia subito.
      inizia.push(c);
      if (inizia.length >= limite) break;
      continue;
    }
    const nome = PIATTI[i];
    // Il nome esatto vince: chi scrive «Forlì» per intero non deve trovarsi
    // Forlimpopoli in cima solo perché in ordine alfabetico viene prima.
    if (nome === cerca) esatti.push(c);
    else if (nome.startsWith(cerca)) inizia.push(c);
    else if (nome.includes(cerca)) contiene.push(c);
  }

  return [...esatti, ...inizia, ...contiene].slice(0, limite).map(vesti);
}

/** Il CAP sta fra quelli che conosciamo per questo comune? */
export function capCoerente(istat: string, cap: string): boolean {
  const c = PER_ISTAT.get(istat.trim());
  if (!c || c.c.length === 0) return true; // non lo sappiamo: non si accusa
  return c.c.includes(cap.trim());
}
