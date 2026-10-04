// La lettura dei CSV dei ricavi esterni. Spec: docs/SPEC_analisi_professionista.md §4.5.
//
// Tutto succede nel browser: il file non arriva mai al server, che riceve
// solo le righe gia' lette (e il pro le ha viste in anteprima). Qui solo
// regole, senza schermo, cosi' si provano con un test.
//
// Cosa si accetta, perche' un CSV vero arriva da Excel italiano:
//   - separatore ; , o tabulazione, scelto guardando l'intestazione;
//   - virgolette per i campi con dentro il separatore;
//   - date gg/mm/aaaa, gg-mm-aaaa, gg.mm.aaaa e aaaa-mm-gg;
//   - importi «1.250,50», «1250.50», «€ 120», «120 €».
// Obbligatorie solo data e importo. Una riga sbagliata si scarta con il
// motivo, non si indovina. I doppioni si segnalano e non si scartano.

export const MAX_RIGHE_CSV = 2000;

export interface RigaLetta {
  /** Numero di riga nel file, intestazione = 1. */
  riga: number;
  data: string; // aaaa-mm-gg
  importoCent: number;
  servizio: string | null;
  comune: string | null;
  cap: string | null;
  cliente: string | null;
  nota: string | null;
  doppione: boolean;
}

export interface RigaScartata {
  riga: number;
  motivo: string;
}

export interface EsitoCsv {
  righe: RigaLetta[];
  scartate: RigaScartata[];
  /** Errore che ferma tutto il file (intestazione, troppe righe). */
  errore: string | null;
}

const COLONNE: Record<string, keyof Omit<RigaLetta, "riga" | "importoCent" | "doppione"> | "importo"> = {
  data: "data",
  giorno: "data",
  "data lavoro": "data",
  importo: "importo",
  euro: "importo",
  "importo (€)": "importo",
  "importo (eur)": "importo",
  prezzo: "importo",
  totale: "importo",
  servizio: "servizio",
  lavoro: "servizio",
  comune: "comune",
  citta: "comune",
  cap: "cap",
  cliente: "cliente",
  "codice cliente": "cliente",
  nota: "nota",
  note: "nota",
};

export function normalizza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function separatore(intestazione: string): string {
  const conta = (c: string) => intestazione.split(c).length - 1;
  const candidati = [";", "\t", ","];
  return candidati.sort((a, b) => conta(b) - conta(a))[0];
}

/** Una riga CSV in campi, con le virgolette ("" dentro = una virgoletta). */
export function campi(riga: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let dentro = false;
  for (let i = 0; i < riga.length; i++) {
    const ch = riga[i];
    if (dentro) {
      if (ch === '"' && riga[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        dentro = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      dentro = true;
    } else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function leggiData(s: string): string | null {
  const t = s.trim();
  let g: number, m: number, a: number;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (r) {
    [a, m, g] = [Number(r[1]), Number(r[2]), Number(r[3])];
  } else {
    r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
    if (!r) return null;
    [g, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (a < 100) a += 2000;
  }
  const d = new Date(Date.UTC(a, m - 1, g));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== g) return null;
  if (a < 2000 || a > 2100) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
}

/** In centesimi. «1.250,50» e «1250.50» valgono uguale; null se non e' un importo. */
export function leggiImporto(s: string): number | null {
  let t = s.replace(/€|eur(o)?/gi, "").replace(/\s/g, "");
  if (!t) return null;
  const virgola = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  if (virgola > punto) {
    // virgola decimale: i punti sono migliaia
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (punto > virgola && virgola >= 0) {
    // punto decimale: le virgole sono migliaia
    t = t.replace(/,/g, "");
  } else if (punto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    // «1.250» senza decimali: e' milleduecentocinquanta, non uno virgola 25
    t = t.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cent = Math.round(Number(t) * 100);
  return Number.isFinite(cent) ? cent : null;
}

export function leggiCsv(testo: string): EsitoCsv {
  const linee = testo.replace(/^﻿/, "").split(/\r\n|\n|\r/);
  while (linee.length && !linee[linee.length - 1].trim()) linee.pop();
  if (linee.length < 2) {
    return { righe: [], scartate: [], errore: "Il file è vuoto o ha solo l'intestazione." };
  }
  if (linee.length - 1 > MAX_RIGHE_CSV) {
    return {
      righe: [],
      scartate: [],
      errore: `Il file ha ${linee.length - 1} righe: il massimo è ${MAX_RIGHE_CSV} per volta. Dividilo in più file.`,
    };
  }

  const sep = separatore(linee[0]);
  const intestazione = campi(linee[0], sep).map(normalizza);
  const indice: Partial<Record<string, number>> = {};
  intestazione.forEach((nome, i) => {
    const chiave = COLONNE[nome];
    if (chiave && indice[chiave] === undefined) indice[chiave] = i;
  });
  if (indice.data === undefined || indice.importo === undefined) {
    return {
      righe: [],
      scartate: [],
      errore: "Servono almeno le colonne «data» e «importo» nella prima riga.",
    };
  }

  const prendi = (c: string[], k: string) => {
    const i = indice[k];
    const v = i === undefined ? "" : (c[i] ?? "").trim();
    return v === "" ? null : v;
  };

  const righe: RigaLetta[] = [];
  const scartate: RigaScartata[] = [];
  const visti = new Set<string>();

  linee.slice(1).forEach((linea, k) => {
    const n = k + 2;
    if (!linea.trim()) return;
    const c = campi(linea, sep);
    const dataGrezza = prendi(c, "data");
    const importoGrezzo = prendi(c, "importo");
    const data = dataGrezza ? leggiData(dataGrezza) : null;
    if (!data) {
      scartate.push({ riga: n, motivo: `data non valida: «${dataGrezza ?? ""}»` });
      return;
    }
    const importoCent = importoGrezzo ? leggiImporto(importoGrezzo) : null;
    if (importoCent === null) {
      scartate.push({ riga: n, motivo: `importo non valido: «${importoGrezzo ?? ""}»` });
      return;
    }
    if (importoCent > 10_000_000) {
      scartate.push({ riga: n, motivo: "importo oltre i 100.000 €" });
      return;
    }
    const capGrezzo = prendi(c, "cap");
    const cap = capGrezzo && /^\d{5}$/.test(capGrezzo) ? capGrezzo : null;
    const cliente = prendi(c, "cliente")?.slice(0, 20) ?? null;
    const chiave = `${data}|${importoCent}|${cliente ?? ""}`;
    const doppione = visti.has(chiave);
    visti.add(chiave);
    righe.push({
      riga: n,
      data,
      importoCent,
      servizio: prendi(c, "servizio"),
      comune: prendi(c, "comune"),
      cap,
      cliente,
      nota: prendi(c, "nota")?.slice(0, 200) ?? null,
      doppione,
    });
  });

  return { righe, scartate, errore: null };
}

/**
 * Il servizio del catalogo che corrisponde a quello scritto: uguale, oppure
 * con le stesse prime sei lettere («idraulica» -> «Idraulico»). Se non c'e'
 * o ce ne sono due, null: meglio «non specificato» che un servizio sbagliato.
 */
export function trovaServizio(
  scritto: string | null,
  catalogo: { id: string; name: string }[]
): string | null {
  if (!scritto) return null;
  const s = normalizza(scritto);
  const uguale = catalogo.find((x) => normalizza(x.name) === s);
  if (uguale) return uguale.id;
  if (s.length < 5) return null;
  const radice = s.slice(0, 6);
  const simili = catalogo.filter((x) => normalizza(x.name).startsWith(radice));
  return simili.length === 1 ? simili[0].id : null;
}

/** «Cliente nuovo → C14»: il numero dopo il piu' alto dei codici Cn usati. */
export function prossimoCodice(usati: (string | null)[]): string {
  let max = 0;
  for (const u of usati) {
    const r = u ? /^c(\d{1,6})$/i.exec(u.trim()) : null;
    if (r) max = Math.max(max, Number(r[1]));
  }
  return `C${max + 1}`;
}
