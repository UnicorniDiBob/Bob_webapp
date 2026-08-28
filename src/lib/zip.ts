// Scrittore ZIP minimo, senza compressione e senza dipendenze.
//
// PERCHE' NON UNA LIBRERIA
// L'export dei dati personali contiene le foto che la persona ha caricato in
// chat: JPEG e PNG, cioe' file gia' compressi. Passarli attraverso deflate
// costa CPU e non toglie byte. Quello che serve davvero e' solo l'involucro:
// un contenitore che il Finder, Esplora file e ogni unzip aprano senza
// chiedere niente. Il formato "store" (metodo 0) e' esattamente questo, sta in
// un file, ed evita di aggiungere una dipendenza a un progetto che ne ha nove.
//
// La scelta ha un prezzo onesto: un bug qui produce un archivio che non si apre,
// cioe' una risposta a una richiesta di accesso che la persona non puo' leggere.
// Per questo l'archivio va provato con un unzip vero, non solo guardato.
//
// LIMITI, dichiarati invece che scoperti: niente ZIP64. Oltre 65.535 file o
// oltre 4 GB il formato classico non basta piu' e la funzione si ferma con un
// errore invece di produrre un archivio corrotto. Per un export personale sono
// soglie che non si avvicinano nemmeno.

export interface FileZip {
  /** Percorso dentro l'archivio, separatore "/". */
  nome: string;
  dati: Uint8Array;
}

const MAX_FILE = 65535;
const MAX_BYTE = 0xffffffff;

// Tabella CRC-32 (polinomio 0xEDB88320), calcolata una volta sola.
const TABELLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = TABELLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Data e ora in formato MS-DOS, come vuole la specifica ZIP: i secondi hanno
// granularita' di due, e l'anno parte dal 1980.
function dataOraDos(d: Date): { ora: number; data: number } {
  const ora =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((d.getSeconds() >> 1) & 0x1f);
  const data =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f);
  return { ora, data };
}

/**
 * Costruisce un archivio ZIP "store" (nessuna compressione) in memoria.
 *
 * Il bit 11 dei flag (0x0800) dichiara che i nomi dei file sono UTF-8: senza,
 * un accento in un nome diventa illeggibile una volta estratto.
 */
export function creaZip(file: FileZip[], quando: Date = new Date()): Buffer {
  if (file.length > MAX_FILE) {
    throw new Error(`ZIP: troppi file (${file.length}), il massimo e' ${MAX_FILE}.`);
  }

  const { ora, data } = dataOraDos(quando);
  const corpo: Buffer[] = [];
  const indice: Buffer[] = [];
  let offset = 0;

  for (const f of file) {
    const nome = Buffer.from(f.nome, "utf8");
    const dati = Buffer.from(f.dati);
    if (dati.length > MAX_BYTE || offset > MAX_BYTE) {
      throw new Error("ZIP: archivio oltre 4 GB, servirebbe ZIP64.");
    }
    const crc = crc32(dati);

    const intestazione = Buffer.alloc(30);
    intestazione.writeUInt32LE(0x04034b50, 0); // firma dell'intestazione locale
    intestazione.writeUInt16LE(20, 4); // versione necessaria per estrarre (2.0)
    intestazione.writeUInt16LE(0x0800, 6); // flag: nomi in UTF-8
    intestazione.writeUInt16LE(0, 8); // metodo 0 = nessuna compressione
    intestazione.writeUInt16LE(ora, 10);
    intestazione.writeUInt16LE(data, 12);
    intestazione.writeUInt32LE(crc, 14);
    intestazione.writeUInt32LE(dati.length, 18); // dimensione compressa
    intestazione.writeUInt32LE(dati.length, 22); // dimensione originale
    intestazione.writeUInt16LE(nome.length, 26);
    intestazione.writeUInt16LE(0, 28); // nessun campo extra

    corpo.push(intestazione, nome, dati);

    const voce = Buffer.alloc(46);
    voce.writeUInt32LE(0x02014b50, 0); // firma della voce di indice
    voce.writeUInt16LE(20, 4); // versione di chi ha scritto
    voce.writeUInt16LE(20, 6); // versione necessaria per estrarre
    voce.writeUInt16LE(0x0800, 8);
    voce.writeUInt16LE(0, 10);
    voce.writeUInt16LE(ora, 12);
    voce.writeUInt16LE(data, 14);
    voce.writeUInt32LE(crc, 16);
    voce.writeUInt32LE(dati.length, 20);
    voce.writeUInt32LE(dati.length, 24);
    voce.writeUInt16LE(nome.length, 28);
    voce.writeUInt16LE(0, 30); // extra
    voce.writeUInt16LE(0, 32); // commento
    voce.writeUInt16LE(0, 34); // numero del disco
    voce.writeUInt16LE(0, 36); // attributi interni
    voce.writeUInt32LE(0, 38); // attributi esterni
    voce.writeUInt32LE(offset, 42); // dove inizia l'intestazione locale

    indice.push(voce, nome);
    offset += intestazione.length + nome.length + dati.length;
  }

  const indiceUnito = Buffer.concat(indice);

  const fine = Buffer.alloc(22);
  fine.writeUInt32LE(0x06054b50, 0); // firma di chiusura
  fine.writeUInt16LE(0, 4); // disco corrente
  fine.writeUInt16LE(0, 6); // disco dell'indice
  fine.writeUInt16LE(file.length, 8);
  fine.writeUInt16LE(file.length, 10);
  fine.writeUInt32LE(indiceUnito.length, 12);
  fine.writeUInt32LE(offset, 16);
  fine.writeUInt16LE(0, 20); // nessun commento

  return Buffer.concat([...corpo, indiceUnito, fine]);
}
