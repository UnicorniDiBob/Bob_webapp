// Un appuntamento come file .ics — RFC 5545, il minimo che i calendari
// accettano davvero (Apple, Google, Outlook, Thunderbird).
//
// COSA CI METTIAMO DENTRO, E PERCHE' COSI' POCO.
// Il file finisce nel calendario della persona, ma un calendario personale si
// sincronizza con Google, Apple o Microsoft e spesso e' condiviso con
// qualcun altro: tutto quello che scriviamo qui esce dai nostri sistemi e
// smette di essere governato dalle nostre regole. Quindi: titolo, giorno, ora
// e durata, piu' un rimando alla conversazione su Bob. NIENTE indirizzo,
// niente numero di telefono, niente nome dell'altra parte. Chi ha bisogno di
// quei dati li trova in chat, dove valgono le regole di sempre — per esempio
// la 044, che mostra l'indirizzo al professionista solo ad appuntamento
// confermato. Un .ics non sa rispettare una regola del genere: non gliela
// diamo da rispettare.

/** Le due cifre servono ovunque nel formato: 20260913T070000Z. */
function due(n: number): string {
  return String(n).padStart(2, "0");
}

/** Istante in UTC nella forma che vuole il formato: YYYYMMDDTHHMMSSZ. */
export function icsData(d: Date): string {
  return (
    `${d.getUTCFullYear()}${due(d.getUTCMonth() + 1)}${due(d.getUTCDate())}` +
    `T${due(d.getUTCHours())}${due(d.getUTCMinutes())}${due(d.getUTCSeconds())}Z`
  );
}

/**
 * Il testo dentro un campo va protetto: barra rovesciata, punto e virgola,
 * virgola e a capo hanno un significato nel formato. Senza questo, un titolo
 * come "Bagno, cucina" spezza l'evento in due campi.
 */
function testo(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Le righe non possono superare 75 ottetti: si spezzano e si riprendono con
 * uno spazio. Si conta in byte, non in caratteri, altrimenti una "à" a
 * cavallo del taglio arriva spezzata a meta'.
 */
function piega(riga: string): string[] {
  // TextEncoder e non Buffer: questo file lo importa anche il componente lato
  // browser (per il link a Google Calendar), e Buffer li' non esiste.
  const byte = new TextEncoder().encode(riga);
  if (byte.length <= 75) return [riga];
  const decoder = new TextDecoder();
  const pezzi: string[] = [];
  let inizio = 0;
  let limite = 75;
  while (inizio < byte.length) {
    let fine = Math.min(inizio + limite, byte.length);
    // Non tagliare in mezzo a un carattere multi-byte: si guardano i bit di
    // continuazione (10xxxxxx) e si arretra fino all'inizio del carattere.
    while (fine > inizio && fine < byte.length && (byte[fine] & 0xc0) === 0x80) {
      fine--;
    }
    pezzi.push(
      (inizio === 0 ? "" : " ") + decoder.decode(byte.subarray(inizio, fine))
    );
    inizio = fine;
    limite = 74; // le righe successive perdono un ottetto per lo spazio
  }
  return pezzi;
}

export interface EventoIcs {
  /** Identificativo stabile: riaprire lo stesso file aggiorna, non duplica. */
  uid: string;
  inizio: Date;
  durataMinuti: number;
  titolo: string;
  /** Dove tornare per parlarne: la conversazione, non l'appuntamento. */
  url?: string;
  /** proposto = TENTATIVE: il calendario lo segna come da confermare. */
  daConfermare?: boolean;
  /** Quando e' stato generato il file (per DTSTAMP). */
  generatoIl?: Date;
}

export function costruisciIcs(e: EventoIcs): string {
  const fine = new Date(e.inizio.getTime() + e.durataMinuti * 60000);
  const righe = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BOB//Appuntamenti//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsData(e.generatoIl ?? new Date())}`,
    `DTSTART:${icsData(e.inizio)}`,
    `DTEND:${icsData(fine)}`,
    `SUMMARY:${testo(e.titolo)}`,
    `STATUS:${e.daConfermare ? "TENTATIVE" : "CONFIRMED"}`,
    `DESCRIPTION:${testo(
      e.daConfermare
        ? "Proposta di appuntamento fissata su BOB. Finché non è confermata può cambiare: la trovi nella tua area personale."
        : "Appuntamento fissato su BOB. Se devi spostarlo, scrivi in chat."
    )}`,
  ];
  if (e.url) righe.push(`URL:${testo(e.url)}`);
  righe.push("END:VEVENT", "END:VCALENDAR");

  // CRLF: il formato lo chiede, e Outlook e' l'unico che se ne accorge.
  return righe.flatMap(piega).join("\r\n") + "\r\n";
}

/**
 * Il link "Google Calendar". Porta gli stessi campi del file, non uno di piu':
 * quello che passa a Google e' titolo e orario, e lo dice l'interfaccia prima
 * che la persona clicchi.
 */
export function linkGoogleCalendar(e: EventoIcs): string {
  const fine = new Date(e.inizio.getTime() + e.durataMinuti * 60000);
  // Composto a mano e non con URLSearchParams: quello codificherebbe anche la
  // barra fra le due date (%2F), e il campo `dates` di Google la vuole intera.
  const dettagli = e.url ? `&details=${encodeURIComponent(e.url)}` : "";
  return (
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(e.titolo)}` +
    `&dates=${icsData(e.inizio)}/${icsData(fine)}` +
    dettagli
  );
}
