// IL CONTROLLO DI UN PDF PRIMA DELLO STORAGE (16/10, strip-exif-client-switch).
//
// Solo per verifica-documenti: visure e attestati arrivano spesso in PDF, e
// /api/upload/immagine e' l'unico ingresso dello storage, quindi anche loro
// passano dal server. Un PDF NON si ri-codifica: si controlla che sia davvero
// un PDF (magic bytes, non il content-type dichiarato) e che pesi il giusto.
//
// I metadati interni del PDF (autore, programma, date) restano: non e' una
// foto, non porta GPS, e riscriverlo vorrebbe dire una libreria di parsing in
// piu' su file scritti da terzi. Il bucket e' privato e lo legge solo lo staff.
//
// 4 MB e non i 10 di prima: una Vercel Function non accetta corpi oltre
// 4,5 MB, e il multipart ci aggiunge sopra confini e intestazioni. Sopra quel
// peso la richiesta morirebbe a Vercel con un errore che non e' nostro.

export const MAX_BYTE_PDF = 4 * 1024 * 1024;

export type EsitoPdf = "ok" | "troppo_grande" | "non_pdf";

/** I primi byte di ogni PDF: "%PDF-". */
export function ePdf(b: Buffer): boolean {
  return b.length >= 5 && b.toString("latin1", 0, 5) === "%PDF-";
}

export function verificaPdf(b: Buffer): EsitoPdf {
  if (b.length > MAX_BYTE_PDF) return "troppo_grande";
  if (!ePdf(b)) return "non_pdf";
  return "ok";
}
