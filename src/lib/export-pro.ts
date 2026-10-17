// Export dei propri dati per il PROFESSIONISTA — artt. 15 e 20 GDPR (17/10).
//
// Fino a oggi /api/account/esporta rispondeva 409 a chi non era cliente
// (findings.csv, serious, 29/09). Questo file aggiunge il blocco del lavoro
// sopra quello dell'account, che resta raccogliDatiCliente: un professionista
// e' anche un utente (email, consensi, termini, assistenza, lista d'attesa), e
// se mai avesse fatto una richiesta da cliente, anche quella e' sua.
//
// L'ELENCO DELLE TABELLE viene dallo schema vivo del 17/10: ogni tabella con
// una chiave verso professionals, piu' quelle per user_id gia' coperte dal
// lato cliente. Come per il cliente, una tabella nuova con professional_id
// entra qui nella stessa PR che la crea.
//
// LA REGOLA SUI CLIENTI: art. 15(4), la copia non deve ledere i diritti
// altrui. Di un cliente esce SOLO quello che il professionista vede gia' nel
// prodotto, ricalcato sulle regole che glielo mostrano, mai di piu':
// - la richiesta: i campi che il prodotto mostra (servizio, zona, CAP,
//   urgenza, budget, descrizione), con la descrizione passata da
//   stripAddresses come in /api/pro/request-summary. Mai customer_id, mai
//   l'id di un altro professionista scelto al suo posto (diventa «te» o «un
//   altro professionista»).
// - l'indirizzo esatto (request_addresses): solo se la richiesta ha un suo
//   appuntamento confermato o completato, la condizione di
//   private.can_see_request_address (mig 044).
// - il brief di Bob (riassunto e al massimo 3 foto): solo alle condizioni di
//   request-summary — assegnazione aperta, non archiviata, richiesta non
//   chiusa, brief che non sia di un altro account — e ogni foto passa da
//   fotoConsegnabile (FOTO1). Chiusa la richiesta, il prodotto non le mostra
//   piu', e qui non escono.
// - gli appuntamenti: la riga che il pro vede nell'agenda (nome che il
//   cliente ha dato, luogo, note, risposte della prenotazione), senza
//   customer_id.
// - la chat: i messaggi della sua conversazione; il mittente e' «tu» o
//   «cliente», niente sender_id.
// - recensioni ricevute: voto, testo, data. Sono pubbliche; l'autore no.
// - MAI telefono o email di un cliente, nemmeno di chi ha accettato. Il
//   prodotto mostra il telefono solo dentro un appuntamento confermato e solo
//   finche' lo e' (contatto_controparte): non e' un dato del professionista, e
//   un file che lo conserva per sempre e' proprio la «lista di contatti» che
//   DATA_COMPLIANCE §4 vieta.
//
// LO STAFF: chi ha esaminato la P.IVA o un documento e' una persona anche lei.
// Esce il ruolo («staff»), non l'id ne' il nome.
//
// I FILE DEL PROFESSIONISTA (documenti di verifica, portfolio, foto caricate)
// si prendono dalle cartelle <user_id>/ dei bucket, dove li scrive solo
// /api/upload/immagine col suo id. NON dai percorsi nelle tabelle:
// verification_documents.storage_path lo scrive il browser e la RLS non lo
// lega alla cartella, quindi non dimostra niente (la lezione di FOTO1).

import type { SupabaseClient } from "@supabase/supabase-js";
import { fotoConsegnabile, percorsoChatValido } from "@/lib/fileUtente";
import { stripAddresses } from "@/lib/redact";
import {
  MAX_BYTE_FOTO,
  MAX_FOTO,
  raccogliDatiCliente,
  type FileAllegato,
  type RisultatoExport,
} from "@/lib/export-dati";

type Riga = Record<string, unknown>;

/** Le cartelle per utente in cui scrive /api/upload/immagine. */
const CARTELLE_PRO: { bucket: string; nelloZip: string }[] = [
  { bucket: "verifica-documenti", nelloZip: "documenti-verifica" },
  { bucket: "portfolio", nelloZip: "portfolio" },
  { bucket: "brief-photos", nelloZip: "foto-caricate" },
];
const PAGINA = 1000;

/** Gli stati in cui request-summary mostra il brief al pro. */
export const STATI_BRIEF_VISIBILE = ["suggested", "contacted", "quote_requested"];
/** Quante foto del brief mostra request-summary. */
export const MAX_FOTO_BRIEF = 3;

async function leggi(admin: SupabaseClient, tabella: string, colonna: string, valore: string): Promise<Riga[]> {
  const { data, error } = await admin.from(tabella).select("*").eq(colonna, valore);
  if (error) throw new Error(`${tabella}: ${error.message}`);
  return (data ?? []) as Riga[];
}

async function leggiIn(admin: SupabaseClient, tabella: string, colonna: string, valori: string[]): Promise<Riga[]> {
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

const perData = (a: Riga, b: Riga) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

/**
 * Private.can_see_request_address ricalcata: l'indirizzo esatto di una
 * richiesta si vede solo con un appuntamento di questo pro confermato o
 * completato. `appuntamenti` sono gia' solo quelli del pro.
 */
export function indirizzoVisibile(appuntamenti: Riga[], requestId: string): boolean {
  return appuntamenti.some(
    (a) => a.request_id === requestId && (a.status === "confirmed" || a.status === "completed")
  );
}

/** Le condizioni con cui /api/pro/request-summary mostra il brief di una richiesta. */
export function briefVisibile(
  assegnazione: Riga | undefined,
  richiesta: Riga,
  brief: Riga | undefined
): boolean {
  if (!assegnazione || !brief) return false;
  if (!STATI_BRIEF_VISIBILE.includes(String(assegnazione.status))) return false;
  if (assegnazione.archived_at) return false;
  if (richiesta.status === "closed") return false;
  const cliente = richiesta.customer_id;
  if (!cliente) return false;
  // requests.brief_id lo scrive il browser: un brief di un altro account non
  // si mostra (uno anonimo si', e' la chat fatta prima di accedere).
  return !brief.user_id || brief.user_id === cliente;
}

/** La richiesta come la vede il pro: i campi del prodotto, niente id di persone. */
export function richiestaPerPro(r: Riga, proId: string): Riga {
  return {
    id: r.id,
    creata_il: r.created_at ?? null,
    stato: r.status ?? null,
    servizio: (r.services as { name?: string } | null)?.name ?? null,
    citta: (r.cities as { name?: string } | null)?.name ?? null,
    zona: r.zone_slug ?? null,
    cap: r.postal_code ?? null,
    urgenza: r.urgency ?? null,
    budget_min: r.budget_min ?? null,
    budget_max: r.budget_max ?? null,
    disponibilita: r.availability_note ?? null,
    modalita_preventivo: r.quote_mode ?? null,
    descrizione: typeof r.problem_description === "string" ? stripAddresses(r.problem_description) : null,
    scelta_del_cliente: r.chosen_professional_id
      ? r.chosen_professional_id === proId
        ? "te"
        : "un altro professionista"
      : null,
  };
}

/** Un percorso dentro la cartella dell'utente, senza salti. */
export function nellaCartella(percorso: unknown, userId: string): percorso is string {
  return typeof percorso === "string" && percorso.startsWith(`${userId}/`) && !percorso.includes("..");
}

async function elencaCartella(admin: SupabaseClient, bucket: string, cartella: string): Promise<string[]> {
  const percorsi: string[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await admin.storage.from(bucket).list(cartella, { limit: PAGINA, offset });
    if (error) throw new Error(`list ${bucket}: ${error.message}`);
    for (const f of data ?? []) if (f.id) percorsi.push(`${cartella}/${f.name}`);
    if (!data || data.length < PAGINA) return percorsi;
  }
}

function nomeFile(percorso: string): string {
  return (percorso.split("/").pop() || "file").replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function raccogliDatiProfessionista(
  admin: SupabaseClient,
  utente: { id: string; email: string }
): Promise<RisultatoExport> {
  // L'account (email, profilo, consensi, termini, assistenza...) e' lo stesso
  // del cliente: si riusa, non si riscrive.
  const base = await raccogliDatiCliente(admin, utente);
  const allegati: FileAllegato[] = [...base.allegati];
  let byte = allegati.reduce((n, f) => n + f.dati.length, 0);
  const cePosto = () => allegati.length < MAX_FOTO && byte < MAX_BYTE_FOTO;

  const professionisti = await leggi(admin, "professionals", "user_id", utente.id);
  const pro = professionisti[0];

  let lavoro: Riga | null = null;
  if (pro) {
    const proId = String(pro.id);
    const [
      servizi, orari, blocchi, copertura, coperturaPubblica, verifica, eventiVerifica, documenti,
      portfolio, assegnazioni, messaggi, appuntamenti, storico, recensioni, segnali,
      abbonamenti, fatture, cambiPiano, contiPagamento, pagamenti, versamenti,
      registroLavoro, mesi, ricavi, revisioneSottoservizi,
    ] = await Promise.all([
      leggi(admin, "professional_services", "professional_id", proId),
      leggi(admin, "professional_availability", "professional_id", proId),
      leggi(admin, "professional_availability_blocks", "professional_id", proId),
      leggi(admin, "professional_coverage", "professional_id", proId),
      leggi(admin, "professional_coverage_public", "professional_id", proId),
      leggi(admin, "professional_verification", "professional_id", proId),
      leggi(admin, "verification_events", "professional_id", proId),
      leggi(admin, "verification_documents", "professional_id", proId),
      leggi(admin, "portfolio_items", "professional_id", proId),
      leggi(admin, "request_professionals", "professional_id", proId),
      leggi(admin, "request_messages", "professional_id", proId),
      leggi(admin, "appointments", "professional_id", proId),
      leggi(admin, "appointment_events", "professional_id", proId),
      leggi(admin, "ratings", "professional_id", proId),
      leggi(admin, "professional_signals", "professional_id", proId),
      leggi(admin, "subscriptions", "professional_id", proId),
      leggi(admin, "subscription_invoices", "professional_id", proId),
      leggi(admin, "subscription_tier_events", "professional_id", proId),
      leggi(admin, "pro_payment_accounts", "professional_id", proId),
      leggi(admin, "payments", "professional_id", proId),
      leggi(admin, "payouts", "professional_id", proId),
      leggi(admin, "professional_work_events", "professional_id", proId),
      leggi(admin, "analisi_mesi", "professional_id", proId),
      leggi(admin, "ricavi_esterni", "professional_id", proId),
      leggi(admin, "subservice_migration_review", "professional_id", proId),
    ]);

    // --- le richieste ricevute, con quello che il prodotto mostra -----------
    const idRichieste = Array.from(new Set(assegnazioni.map((a) => String(a.request_id))));
    let richieste: Riga[] = [];
    if (idRichieste.length) {
      const { data, error } = await admin
        .from("requests")
        .select("*, services ( name ), cities ( name )")
        .in("id", idRichieste);
      if (error) throw new Error(`requests: ${error.message}`);
      richieste = (data ?? []) as Riga[];
    }
    const conIndirizzo = idRichieste.filter((id) => indirizzoVisibile(appuntamenti, id));
    const indirizzi = await leggiIn(admin, "request_addresses", "request_id", conIndirizzo);

    const assegnazionePer = new Map(assegnazioni.map((a) => [String(a.request_id), a]));
    const idBrief = Array.from(
      new Set(richieste.map((r) => r.brief_id).filter((x): x is string => typeof x === "string"))
    );
    const briefs = await leggiIn(admin, "job_briefs", "id", idBrief);
    const briefPer = new Map(briefs.map((b) => [String(b.id), b]));

    const richiesteRicevute: Riga[] = [];
    for (const r of richieste.sort(perData)) {
      const id = String(r.id);
      const assegnazione = assegnazionePer.get(id);
      const brief = r.brief_id ? briefPer.get(String(r.brief_id)) : undefined;
      let scheda: Riga | null = null;
      if (briefVisibile(assegnazione, r, brief)) {
        const foto: Riga[] = [];
        const elenco = Array.isArray(brief!.photos) ? (brief!.photos as Riga[]) : [];
        for (const f of elenco.slice(0, MAX_FOTO_BRIEF)) {
          const percorso = f.storagePath;
          const voce: Riga = { descrizione_automatica: f.aiCaption ?? null, nel_file: null };
          const consegnabile =
            percorsoChatValido(percorso) &&
            (await fotoConsegnabile(
              admin,
              { id: String(brief!.id), created_at: String(brief!.created_at ?? "") },
              String(r.customer_id),
              percorso
            ));
          // Come request-summary: una foto che non passa non si mostra, quindi
          // qui non si elenca nemmeno.
          if (!consegnabile) continue;
          if (!cePosto()) {
            voce.nota = "Non inclusa per limiti di dimensione: richiedi un nuovo export domani o scrivici.";
            foto.push(voce);
            continue;
          }
          const { data: blob, error } = await admin.storage.from("brief-photos").download(percorso);
          if (error || !blob) continue;
          const dati = new Uint8Array(await blob.arrayBuffer());
          byte += dati.length;
          const nome = `richieste/${id}/${nomeFile(percorso)}`;
          allegati.push({ nome, dati });
          voce.nel_file = nome;
          foto.push(voce);
        }
        scheda = { riassunto: brief!.summary ?? null, foto };
      }
      richiesteRicevute.push({
        ...richiestaPerPro(r, proId),
        la_tua_assegnazione: senza(assegnazione, "professional_id", "request_id"),
        indirizzo_esatto: (() => {
          const i = indirizzi.find((x) => x.request_id === id);
          return i ? { indirizzo: i.address_line ?? null, citta: i.city_name ?? null, note: i.notes ?? null } : null;
        })(),
        scheda_di_bob: scheda,
        conversazione: messaggi
          .filter((m) => m.request_id === id)
          .sort(perData)
          .map((m) => ({
            ...senza(m, "sender_id", "professional_id"),
            mittente: m.sender_type === "professional" ? "tu" : m.sender_type === "customer" ? "cliente" : String(m.sender_type ?? ""),
          })),
      });
    }

    // Messaggi senza una richiesta fra le assegnazioni (non dovrebbero
    // esserci): non si buttano, si consegnano a parte, come gli altri.
    const orfani = messaggi.filter((m) => !idRichieste.includes(String(m.request_id)));

    // --- staff: il ruolo, non la persona -----------------------------------
    const chi = (id: unknown, ruolo?: unknown) =>
      id && id === utente.id ? "tu" : id || ruolo ? `staff${ruolo ? ` (${String(ruolo)})` : ""}` : null;

    // --- i file nelle cartelle del pro --------------------------------------
    const file: Riga[] = [];
    for (const { bucket, nelloZip } of CARTELLE_PRO) {
      for (const percorso of await elencaCartella(admin, bucket, utente.id)) {
        if (!nellaCartella(percorso, utente.id)) continue;
        const voce: Riga = { archivio: bucket, nel_file: null };
        if (!cePosto()) {
          voce.nota = "Non incluso per limiti di dimensione: richiedi un nuovo export domani o scrivici.";
          file.push(voce);
          continue;
        }
        const { data: blob, error } = await admin.storage.from(bucket).download(percorso);
        if (error || !blob) {
          voce.nota = "File non piu' disponibile.";
          file.push(voce);
          continue;
        }
        const dati = new Uint8Array(await blob.arrayBuffer());
        byte += dati.length;
        const nome = `${nelloZip}/${nomeFile(percorso)}`;
        allegati.push({ nome, dati });
        voce.nel_file = nome;
        voce.percorso = percorso;
        file.push(voce);
      }
    }
    const fileDi = (percorso: unknown) => file.find((f) => f.percorso === percorso)?.nel_file ?? null;
    const fileDiUrl = (url: unknown) =>
      typeof url === "string" ? file.find((f) => typeof f.percorso === "string" && url.endsWith(`/portfolio/${f.percorso}`))?.nel_file ?? null : null;

    const verificaRiga = verifica[0];
    lavoro = {
      profilo_professionale: senza(pro, "user_id"),
      servizi_e_prezzi: servizi.map((r) => senza(r, "professional_id")),
      orari_settimanali: orari.map((r) => senza(r, "professional_id")),
      giorni_bloccati: blocchi.map((r) => senza(r, "professional_id")),
      zone_coperte: copertura.map((r) => senza(r, "professional_id")),
      zone_coperte_come_le_vede_la_ricerca: coperturaPubblica.map((r) => senza(r, "professional_id")),
      verifica: verificaRiga
        ? {
            ...senza(verificaRiga, "professional_id", "vat_reviewed_by", "vat_reviewed_by_name"),
            esaminata_da: verificaRiga.vat_reviewed_by || verificaRiga.vat_reviewed_by_name ? "staff" : null,
          }
        : null,
      storico_della_verifica: eventiVerifica.sort(perData).map((e) => ({
        ...senza(e, "professional_id", "actor_user_id", "actor_name", "actor_role"),
        autore: chi(e.actor_user_id, e.actor_role),
      })),
      documenti_di_verifica: documenti.map((d) => ({
        ...senza(d, "professional_id", "uploaded_by", "reviewed_by"),
        caricato_da: chi(d.uploaded_by),
        esaminato_da: d.reviewed_by ? chi(d.reviewed_by) : null,
        nel_file: fileDi(d.storage_path),
      })),
      portfolio: portfolio.map((p) => ({ ...senza(p, "professional_id"), nel_file: fileDiUrl(p.image_url) })),
      file_caricati: file.map((f) => senza(f, "percorso")),
      richieste_ricevute: richiesteRicevute,
      messaggi_senza_richiesta: orfani.map((m) => senza(m, "sender_id", "professional_id")),
      appuntamenti: appuntamenti.sort(perData).map((a) => ({
        ...senza(a, "customer_id", "professional_id"),
        storico: storico
          .filter((e) => e.appointment_id === a.id)
          .sort(perData)
          .map((e) => ({
            ...senza(e, "autore_id", "professional_id"),
            autore: e.autore === "professional" ? "tu" : e.autore === "customer" ? "cliente" : "Bob",
          })),
      })),
      recensioni_ricevute: recensioni.sort(perData).map((r) => ({
        id: r.id,
        voto: r.score ?? null,
        testo: r.comment ?? null,
        scritta_il: r.created_at ?? null,
        richiesta: r.request_id ?? null,
      })),
      tempo_di_risposta: senza(segnali[0], "professional_id"),
      abbonamento: abbonamenti.map((r) => senza(r, "professional_id")),
      fatture_abbonamento: fatture.map((r) => senza(r, "professional_id")),
      cambi_di_piano: cambiPiano.map((r) => senza(r, "professional_id")),
      conto_pagamenti: contiPagamento.map((r) => senza(r, "professional_id")),
      pagamenti_ricevuti: pagamenti.map((r) => senza(r, "customer_id", "professional_id")),
      versamenti: versamenti.map((r) => senza(r, "professional_id")),
      registro_del_lavoro: registroLavoro.map((r) => senza(r, "professional_id")),
      analisi_mensile: mesi.map((r) => senza(r, "professional_id")),
      ricavi_inseriti_da_te: ricavi.map((r) => senza(r, "professional_id")),
      revisione_sottoservizi: revisioneSottoservizi.map((r) => senza(r, "professional_id")),
    };
  }

  const documento: Record<string, unknown> = {
    ...base.documento,
    cosa_non_e_qui_dentro:
      "Le ricerche fatte sul sito non compaiono perche' non sono collegate a nessun account. Dei tuoi clienti trovi solo quello che vedi gia' su Bob, e mai il loro telefono o la loro email: sono dati loro, non tuoi (art. 15(4) GDPR). L'indirizzo esatto di un lavoro c'e' solo se hai un appuntamento confermato o completato per quella richiesta; le foto di una richiesta solo finche' la richiesta e' aperta, come nel prodotto.",
    attivita_da_professionista: lavoro,
  };

  return { documento, allegati };
}
