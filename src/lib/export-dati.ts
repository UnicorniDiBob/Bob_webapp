// Export dei propri dati — artt. 15 e 20 GDPR.
//
// LA REGOLA CHE GUIDA TUTTO IL FILE: quello che consegniamo deve essere
// COMPLETO. Un export che dice "ecco tutto" e lascia fuori una tabella non e'
// un export parziale, e' una risposta sbagliata a una richiesta di accesso. Per
// questo l'elenco qui sotto e' stato ricavato interrogando lo schema vivo, non
// ricordando quali tabelle esistono, e per questo va riletto ogni volta che
// nasce una tabella con dentro un user_id.
//
// LE DUE COSE CHE UN CONTROLLO A MEMORIA AVREBBE PERSO
//
// 1. city_waitlist NON HA user_id: la chiave e' l'email. Chi si era iscritto
//    alla lista d'attesa di una citta' prima di registrarsi ha una riga che
//    nessuna ricerca per user_id trovera' mai. Si cerca anche per email.
// 2. search_events NON HA un utente, di proposito (mig 026). Le ricerche sono
//    davvero anonime, quindi restano fuori — e il file lo dice, invece di
//    lasciar credere che ce le siamo dimenticate.
// 3. public.users NON CONTIENE L'EMAIL: ha solo id, role e created_at. L'email,
//    la conferma dell'indirizzo e l'ultimo accesso vivono in auth.users, cioe'
//    nello schema di Supabase, e si leggono con l'API di amministrazione. Un
//    export costruito guardando solo lo schema public avrebbe consegnato a una
//    persona la copia dei suoi dati SENZA il suo indirizzo email: il dato con
//    cui l'account esiste. Trovato provando le query sul database vero.
//
// I MESSAGGI DEL PROFESSIONISTA CI STANNO DENTRO. Una conversazione tagliata a
// meta' non e' una copia della conversazione. L'art. 15(4) protegge i diritti
// altrui, ma qui l'altro e' un professionista che scrive in quanto tale, a un
// cliente che quei messaggi li ha gia' letti tutti: non gli stiamo rivelando
// niente che non abbia gia'. Quello che togliamo e' l'identificativo interno
// del pro (sender_id), che al cliente non serve e non e' suo: al suo posto
// mettiamo il nome con cui il pro si presenta sulla piattaforma.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Un export ogni 24 ore: art. 12(5), richieste "eccessive per ripetitivita'". */
export const INTERVALLO_EXPORT_ORE = 24;
export const INTERVALLO_EXPORT_MS = INTERVALLO_EXPORT_ORE * 60 * 60 * 1000;

/**
 * Tetti sulle foto. Non sono un limite al diritto: sono la differenza fra una
 * rotta che risponde e una che va in timeout su Vercel lasciando la persona
 * senza niente. Se si toccano, il file lo dichiara riga per riga.
 */
export const MAX_FOTO = 100;
export const MAX_BYTE_FOTO = 40 * 1024 * 1024;

export interface FileAllegato {
  nome: string;
  dati: Uint8Array;
}

export interface RisultatoExport {
  documento: Record<string, unknown>;
  allegati: FileAllegato[];
}

interface Riga {
  [k: string]: unknown;
}

async function leggi(
  admin: SupabaseClient,
  tabella: string,
  colonna: string,
  valore: string
): Promise<Riga[]> {
  const { data, error } = await admin.from(tabella).select("*").eq(colonna, valore);
  if (error) throw new Error(`${tabella}: ${error.message}`);
  return (data ?? []) as Riga[];
}

async function leggiIn(
  admin: SupabaseClient,
  tabella: string,
  colonna: string,
  valori: string[]
): Promise<Riga[]> {
  if (valori.length === 0) return [];
  const { data, error } = await admin.from(tabella).select("*").in(colonna, valori);
  if (error) throw new Error(`${tabella}: ${error.message}`);
  return (data ?? []) as Riga[];
}

function senza(riga: Riga | undefined, ...chiavi: string[]): Riga | null {
  if (!riga) return null;
  const copia = { ...riga };
  for (const c of chiavi) delete copia[c];
  return copia;
}

/**
 * Nome pubblico dei professionisti coinvolti: professionals.id -> nome.
 * Il nome sta in profiles.full_name, agganciato via professionals.user_id.
 */
async function nomiProfessionisti(
  admin: SupabaseClient,
  idProfessionisti: string[]
): Promise<Record<string, string>> {
  if (idProfessionisti.length === 0) return {};
  const { data: pros } = await admin
    .from("professionals")
    .select("id, user_id")
    .in("id", idProfessionisti);
  const righe = (pros ?? []) as { id: string; user_id: string }[];
  if (righe.length === 0) return {};

  const { data: profili } = await admin
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", righe.map((p) => p.user_id));
  const perUtente: Record<string, string> = {};
  for (const p of (profili ?? []) as { user_id: string; full_name: string | null }[]) {
    if (p.full_name) perUtente[p.user_id] = p.full_name;
  }

  const mappa: Record<string, string> = {};
  for (const p of righe) mappa[p.id] = perUtente[p.user_id] ?? "Professionista";
  return mappa;
}

/** Ultimo segmento di un percorso storage, ripulito per un nome di file. */
function nomeFile(percorso: string): string {
  const base = percorso.split("/").pop() || "foto";
  return base.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function raccogliDatiCliente(
  admin: SupabaseClient,
  utente: { id: string; email: string }
): Promise<RisultatoExport> {
  // --- 1. chi sei -----------------------------------------------------------
  const [account, profilo, riservati, telefono, autenticazione] = await Promise.all([
    leggi(admin, "users", "id", utente.id),
    leggi(admin, "profiles", "user_id", utente.id),
    leggi(admin, "profile_private", "user_id", utente.id),
    leggi(admin, "profile_phone", "user_id", utente.id),
    // vedi la nota 3 in testa al file: l'email non sta in public.users
    admin.auth.admin.getUserById(utente.id),
  ]);

  const authUser = autenticazione.data?.user ?? null;

  // --- 2. cosa hai messo tu -------------------------------------------------
  const [indirizzi, consensi, memoria, assistenza, promo, cancellazione, attesa] =
    await Promise.all([
      leggi(admin, "customer_addresses", "user_id", utente.id),
      leggi(admin, "communication_consents", "user_id", utente.id),
      leggi(admin, "customer_memory", "user_id", utente.id),
      leggi(admin, "support_tickets", "user_id", utente.id),
      leggi(admin, "promo_redemptions", "user_id", utente.id),
      leggi(admin, "account_deletion_requests", "user_id", utente.id),
      // vedi la nota in testa al file: qui la chiave e' l'email, non l'utente
      leggi(admin, "city_waitlist", "email", utente.email),
    ]);

  // --- 3. le richieste, con dentro tutto quello che le riguarda -------------
  const richieste = await leggi(admin, "requests", "customer_id", utente.id);
  const idRichieste = richieste.map((r) => String(r.id));

  const [indirizziRichiesta, messaggi, appuntamenti, recensioni, brief] =
    await Promise.all([
      leggiIn(admin, "request_addresses", "request_id", idRichieste),
      leggiIn(admin, "request_messages", "request_id", idRichieste),
      leggi(admin, "appointments", "customer_id", utente.id),
      leggi(admin, "ratings", "customer_id", utente.id),
      // per user_id e non per richiesta: un brief nato in chat e mai diventato
      // una richiesta e' comunque un dato che la persona ci ha dato.
      leggi(admin, "job_briefs", "user_id", utente.id),
    ]);

  const idPro = Array.from(
    new Set(
      [...messaggi, ...appuntamenti, ...recensioni]
        .map((r) => r.professional_id)
        .filter((x): x is string => typeof x === "string")
    )
  );
  const nomePro = await nomiProfessionisti(admin, idPro);

  const messaggiPuliti = messaggi
    .map((m) => {
      const mio = m.sender_id === utente.id;
      const pulito = senza(m, "sender_id") as Riga;
      pulito.mittente = mio
        ? "tu"
        : nomePro[String(m.professional_id)] ?? "Professionista";
      return pulito;
    })
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));

  const briefPerId = new Map(brief.map((b) => [String(b.id), b]));
  const richiesteComplete = richieste.map((r) => ({
    ...r,
    indirizzo: indirizziRichiesta.find((i) => i.request_id === r.id) ?? null,
    scheda_raccolta_da_bob: r.brief_id ? briefPerId.get(String(r.brief_id)) ?? null : null,
    conversazione: messaggiPuliti.filter((m) => m.request_id === r.id),
  }));

  // --- 4. le foto caricate in chat ------------------------------------------
  // Sono dati "forniti dall'interessato" nel senso pieno dell'art. 20: se
  // l'export ne restituisse solo il nome, la persona non le riavrebbe.
  const allegati: FileAllegato[] = [];
  const elencoFoto: Riga[] = [];
  let byteScaricati = 0;

  for (const b of brief) {
    const foto = Array.isArray(b.photos) ? (b.photos as Riga[]) : [];
    for (const f of foto) {
      const percorso = typeof f.storagePath === "string" ? f.storagePath : null;
      if (!percorso) continue;

      const voce: Riga = {
        scheda: b.id,
        descrizione_automatica: f.aiCaption ?? null,
        nel_file: null,
      };

      if (allegati.length >= MAX_FOTO || byteScaricati >= MAX_BYTE_FOTO) {
        voce.nota =
          "Non inclusa in questo archivio per limiti di dimensione: richiedi un nuovo export domani o scrivici.";
        elencoFoto.push(voce);
        continue;
      }

      const { data: blob, error } = await admin.storage
        .from("brief-photos")
        .download(percorso);
      if (error || !blob) {
        voce.nota = "File non piu' disponibile nell'archivio delle foto.";
        elencoFoto.push(voce);
        continue;
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      byteScaricati += bytes.length;
      const nome = `foto/${b.id}/${nomeFile(percorso)}`;
      allegati.push({ nome, dati: bytes });
      voce.nel_file = nome;
      elencoFoto.push(voce);
    }
  }

  // --- 5. il documento ------------------------------------------------------
  const documento: Record<string, unknown> = {
    esportato_il: new Date().toISOString(),
    riferimenti_normativi: "Artt. 15 e 20 del Regolamento (UE) 2016/679 (GDPR).",
    cosa_non_e_qui_dentro:
      "Le ricerche fatte sul sito non compaiono perche' non sono collegate a nessun account: le registriamo senza sapere chi le ha fatte. Le foto che avevi caricato in chat sono nella cartella foto/ di questo archivio.",
    account: {
      email: utente.email,
      ...(senza(account[0], "id") ?? {}),
      email_confermata_il: authUser?.email_confirmed_at ?? null,
      ultimo_accesso: authUser?.last_sign_in_at ?? null,
      modo_di_accesso: (authUser?.app_metadata?.providers as string[] | undefined) ?? null,
    },
    profilo: senza(profilo[0], "user_id"),
    dati_riservati: senza(riservati[0], "user_id"),
    telefono: senza(telefono[0], "user_id"),
    indirizzi_salvati: indirizzi.map((r) => senza(r, "user_id")),
    consensi_alle_comunicazioni: consensi.map((r) => senza(r, "user_id")),
    memoria_delle_ricerche: senza(memoria[0], "user_id"),
    richieste: richiesteComplete,
    schede_raccolte_da_bob: brief.map((r) => senza(r, "user_id")),
    appuntamenti: appuntamenti.map((r) => ({
      ...senza(r, "customer_id"),
      professionista: nomePro[String(r.professional_id)] ?? null,
    })),
    recensioni_che_hai_scritto: recensioni.map((r) => ({
      ...senza(r, "customer_id"),
      professionista: nomePro[String(r.professional_id)] ?? null,
    })),
    richieste_di_assistenza: assistenza.map((r) => senza(r, "user_id")),
    codici_promozionali_usati: promo.map((r) => senza(r, "user_id")),
    cancellazione_in_corso: senza(cancellazione[0], "user_id"),
    liste_di_attesa: attesa,
    foto: elencoFoto,
  };

  return { documento, allegati };
}

/** Il foglio di accompagnamento: art. 12(1), "forma concisa e intelligibile". */
export function leggimi(quando: Date): string {
  return [
    "I TUOI DATI SU BOB",
    "",
    `Archivio generato il ${quando.toLocaleString("it-IT")}.`,
    "",
    "Cosa c'e' qui dentro",
    "  dati.json   tutto quello che Bob tiene collegato al tuo account.",
    "  foto/       le fotografie che hai caricato parlando con Bob, una",
    "              cartella per ogni richiesta.",
    "",
    "Perche' JSON",
    "  E' un formato di testo che si apre con qualsiasi editor e che un altro",
    "  servizio puo' leggere senza intervento umano. E' quello che l'art. 20",
    "  del GDPR chiede quando parla di dati 'in formato strutturato, di uso",
    "  comune e leggibile da dispositivo automatico'.",
    "",
    "Cosa NON c'e'",
    "  Le ricerche fatte sul sito: non sono collegate a nessun account, quindi",
    "  non sappiamo quali siano le tue.",
    "",
    "Se qualcosa non torna, o pensi che manchi qualcosa, scrivici: hai diritto",
    "a una risposta e anche a rivolgerti al Garante per la protezione dei dati",
    "personali (www.garanteprivacy.it).",
    "",
  ].join("\n");
}
