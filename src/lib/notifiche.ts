"use client";

// LE NOTIFICHE DI SERVIZIO, IN UN POSTO SOLO.
//
// PERCHE' ESISTE (deciso il 30/08 con Lucio). Fino a ieri le comunicazioni che
// Bob deve a chi lo usa erano sparse in quattro posti diversi, ognuno con la
// sua forma: la partita IVA in un riquadro sulla dashboard, le risposte dello
// staff sepolte in /impostazioni/assistenza senza che nulla dicesse che erano
// arrivate, la cancellazione dell'account in una fascia rossa sotto
// l'intestazione, «compari nelle ricerche» in un riquadro dell'area di lavoro.
// Quattro linguaggi per la stessa cosa — noi che parliamo all'utente — e
// nessun posto dove chiedersi «c'e' qualcosa per me?». Adesso c'e': la
// campanella nell'header, la stessa da qualunque pagina, e /notifiche per il
// dettaglio.
//
// COSA E' UNA NOTIFICA DI SERVIZIO E COSA NO. Sono i messaggi che riguardano
// l'ACCOUNT e lo STATO nel prodotto: verifica, staff, cancellazione,
// visibilita' del profilo. NON sono i messaggi dei clienti — quelli hanno gia'
// la loro casa (/messaggi, la bolla, il badge dei non letti) e mescolarli
// significherebbe che un preventivo perso e un promemoria burocratico
// suonano uguale.
//
// NON C'E' UNA TABELLA, ED E' VOLUTO. Ogni voce e' DERIVATA da righe che
// esistono gia' (professional_verification, support_tickets,
// account_deletion_requests, professionals). Una tabella `notifications`
// vorrebbe dire: nuova migrazione, nuova RLS, nuova regola di retention, nuova
// riga di RoPA e un percorso di cancellazione — per dati che sono solo una
// vista di dati che gia' abbiamo, e che si disallineerebbero al primo trigger
// dimenticato. Quando servira' mandarle davvero (email, push) allora la coda
// avra' senso: oggi no.
//
// LO STATO «LETTO» STA NEL BROWSER, non sul server: e' una preferenza
// d'interfaccia, dura quanto il dispositivo e non deve finire in nessun
// registro dei trattamenti (stessa logica di lib/guidaProgresso.ts). Prezzo
// dichiarato: se apri le notifiche sul telefono, il computer non lo sa. Per il
// pilota e' il prezzo giusto; il giorno che non lo sara', diventa una colonna
// su users e questo file cambia in un punto solo.

import type { SupabaseClient } from "@supabase/supabase-js";

export type LivelloNotifica = "azione" | "avviso" | "fatto";

export interface Notifica {
  /** Stabile: la stessa cosa ha sempre lo stesso id, cosi' «letto» regge. */
  id: string;
  livello: LivelloNotifica;
  titolo: string;
  testo: string;
  /** Dove si risolve. Sempre una pagina che esiste. */
  href: string;
  /** Il testo del link: dice cosa succede cliccando, non «vai». */
  azione: string;
  /** Quando la notizia e' nata. null = e' uno stato, non un evento. */
  quando: string | null;
  /** Chi parla: lo staff ha un nome, il sistema non ne ha uno. */
  mittente?: string | null;
}

// ---------------------------------------------------------------------------
// La regola della visibilita', scritta una volta sola
// ---------------------------------------------------------------------------
//
// E' la stessa condizione della migrazione 062 e di getProfessionals(): almeno
// un servizio dichiarato e profilo non spento. La ripetiamo qui in italiano
// perche' la frase che legge il professionista deve nascere dallo stesso
// posto della regola, altrimenti il giorno che la regola cambia restano due
// verita'. useStatoProfilo importa da qui.

export interface FattiVisibilita {
  servizi: number;
  disattivato: boolean;
}

/**
 * Il motivo per cui NON compare, in una frase che si puo' leggere ad alta
 * voce. null quando compare.
 */
export function motivoInvisibile(f: FattiVisibilita): string | null {
  if (f.disattivato) {
    return "il tuo profilo è spento: l'hai disattivato tu, oppure è in corso la cancellazione dell'account";
  }
  if (f.servizi === 0) {
    return "non hai ancora dichiarato che lavoro fai, e gli elenchi dei clienti filtrano per servizio: senza, non c'è nessuna ricerca in cui il tuo profilo possa uscire";
  }
  return null;
}

/** Dove si risolve il motivo qui sopra. */
export function dovesiSistema(f: FattiVisibilita): string {
  return f.disattivato ? "/impostazioni/accesso" : "/impostazioni/azienda";
}

// ---------------------------------------------------------------------------
// Il caricamento
// ---------------------------------------------------------------------------

export interface ContestoNotifiche {
  userId: string;
  role: string | null;
}

const ORDINE_LIVELLO: Record<LivelloNotifica, number> = {
  azione: 0,
  avviso: 1,
  fatto: 2,
};

/**
 * Legge le notifiche di servizio di chi sta guardando. Non lancia mai: una
 * campanella che rompe la pagina è peggio di una campanella vuota. Ogni
 * lettura fallita toglie la sua voce e lascia le altre.
 */
export async function caricaNotifiche(
  supabase: SupabaseClient,
  ctx: ContestoNotifiche
): Promise<Notifica[]> {
  const out: Notifica[] = [];
  const pro = ctx.role === "professional";

  const [cancellazione, ticket, profilo] = await Promise.all([
    supabase
      .from("account_deletion_requests")
      .select("scheduled_for, requested_at")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    supabase
      .from("support_tickets")
      .select("id, ref, subject, staff_reply, staff_reply_at, status")
      .eq("user_id", ctx.userId)
      .not("staff_reply", "is", null)
      .order("staff_reply_at", { ascending: false })
      .limit(10),
    pro
      ? supabase
          .from("professionals")
          .select("id, ready_at, deactivated_at")
          .eq("user_id", ctx.userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  // 1. Cancellazione dell'account: la cosa piu' irreversibile che ci sia in
  //    questo elenco, quindi la prima.
  const canc = cancellazione.error
    ? null
    : (cancellazione.data as { scheduled_for: string } | null);
  if (canc?.scheduled_for) {
    const quando = new Date(canc.scheduled_for);
    const giorni = Math.max(
      0,
      Math.ceil((quando.getTime() - Date.now()) / 86_400_000)
    );
    out.push({
      id: "cancellazione",
      livello: "azione",
      titolo: "Il tuo account verrà cancellato",
      testo: `${
        giorni === 0 ? "Entro oggi" : giorni === 1 ? "Domani" : `Fra ${giorni} giorni`
      }, il ${quando.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}. Da adesso il tuo profilo non è più visibile. Puoi tornare indietro fino a quel momento.`,
      href: "/impostazioni/accesso",
      azione: "Annulla la cancellazione",
      quando: null,
    });
  }

  // 2. Le risposte dello staff. SONO notifiche di servizio a tutti gli
  //    effetti: le scriviamo noi, riguardano l'account, e finora arrivavano
  //    in silenzio dentro una sezione delle impostazioni.
  if (!ticket.error) {
    for (const t of (ticket.data ?? []) as Array<{
      id: string;
      ref: string;
      subject: string;
      staff_reply: string;
      staff_reply_at: string | null;
      status: string;
    }>) {
      out.push({
        id: `ticket:${t.id}:${t.staff_reply_at ?? ""}`,
        livello: "avviso",
        titolo: `Risposta alla tua richiesta ${t.ref}`,
        testo: `«${t.subject}» — ${t.staff_reply}`,
        href: "/impostazioni/assistenza",
        azione: "Apri la richiesta",
        quando: t.staff_reply_at,
        mittente: "Assistenza Bob",
      });
    }
  }

  if (!pro) return ordina(out);

  const rigaPro = profilo.error
    ? null
    : (profilo.data as {
        id: string;
        ready_at: string | null;
        deactivated_at: string | null;
      } | null);
  if (!rigaPro) return ordina(out);

  const [servizi, verifica] = await Promise.all([
    supabase
      .from("professional_services")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", rigaPro.id),
    supabase
      .from("professional_verification")
      .select("level, vat_review_state, vat_review_note, vat_reviewed_at, vat_reviewed_by_name")
      .eq("professional_id", rigaPro.id)
      .maybeSingle(),
  ]);

  // 3. Compari nelle ricerche, con il MOTIVO in chiaro. Prima la frase era
  //    «il primo punto qui sotto è quello che ti tiene fuori»: un rimando a
  //    una lista, non una risposta. Adesso il motivo è il titolo.
  if (!servizi.error) {
    const fatti: FattiVisibilita = {
      servizi: servizi.count ?? 0,
      disattivato: Boolean(rigaPro.deactivated_at),
    };
    const motivo = motivoInvisibile(fatti);
    if (motivo) {
      out.push({
        id: "profilo-invisibile",
        livello: "azione",
        titolo: "I clienti non ti trovano",
        testo: `Non compari in nessuna ricerca perché ${motivo}.`,
        href: dovesiSistema(fatti),
        azione: fatti.disattivato ? "Riaccendi il profilo" : "Dichiara cosa fai",
        quando: null,
      });
    } else if (rigaPro.ready_at) {
      out.push({
        id: "profilo-visibile",
        livello: "fatto",
        titolo: "Il tuo profilo è nelle ricerche",
        testo: `Da${
          rigaPro.ready_at
            ? "l " +
              new Date(rigaPro.ready_at).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
              })
            : "desso"
        } i clienti possono trovarti. Zone e orari non ti nascondono: cambiano quante richieste ricevi e a che ora ti proponiamo.`,
        href: "/dashboard",
        azione: "Vedi il tuo profilo",
        quando: rigaPro.ready_at,
      });
    }
  }

  // 4. La verifica della partita IVA. Stessi quattro stati del vecchio
  //    riquadro sulla dashboard, stesse parole: cambia il posto, non il
  //    contenuto. Le note dello staff (vat_review_note) sono messaggi scritti
  //    da una persona e vanno lette come tali.
  const v = verifica.error
    ? null
    : (verifica.data as {
        level: string | null;
        vat_review_state: string | null;
        vat_review_note: string | null;
        vat_reviewed_at: string | null;
        vat_reviewed_by_name: string | null;
      } | null);
  const livelloVerifica = v?.level ?? "none";
  const stato = v?.vat_review_state ?? null;

  if (stato === "docs_requested") {
    out.push({
      id: `verifica:docs:${v?.vat_reviewed_at ?? ""}`,
      livello: "azione",
      titolo: "Ci serve un documento per completare la verifica",
      testo:
        v?.vat_review_note ??
        "Ti contattiamo noi con le istruzioni per inviarlo: appena lo riceviamo completiamo il controllo.",
      href: "/impostazioni/verifica",
      azione: "Apri la verifica",
      quando: v?.vat_reviewed_at ?? null,
      mittente: v?.vat_reviewed_by_name ?? "Staff Bob",
    });
  } else if (stato === "rejected") {
    out.push({
      id: `verifica:rifiutata:${v?.vat_reviewed_at ?? ""}`,
      livello: "azione",
      titolo: "La richiesta di verifica non è stata accolta",
      testo:
        v?.vat_review_note ??
        "Se i dati che abbiamo controllato non sono corretti, puoi correggerli e ripresentare la richiesta: la rivediamo a mano.",
      href: "/impostazioni/verifica",
      azione: "Correggi e ripresenta",
      quando: v?.vat_reviewed_at ?? null,
      mittente: v?.vat_reviewed_by_name ?? "Staff Bob",
    });
  } else if (stato === "pending") {
    out.push({
      id: "verifica:in-esame",
      livello: "avviso",
      titolo: "La tua verifica è in esame",
      testo:
        "Il controllo automatico non ha potuto confermare da solo la partita IVA — succede spesso, per esempio a chi non lavora con l'estero o lavora con una società. La stiamo controllando a mano: non serve fare altro.",
      href: "/impostazioni/verifica",
      azione: "Vedi lo stato",
      quando: null,
      mittente: "Assistenza Bob",
    });
  } else if (livelloVerifica === "none") {
    // L'invito alla verifica vale solo per chi ha un piano che la include:
    // spingerla a un Free e' un vicolo cieco (decisione del 14/08). Il piano
    // lo leggiamo qui perche' e' l'unico posto che ne ha bisogno.
    const { data: piano } = await supabase
      .from("professionals")
      .select("subscription_tier")
      .eq("id", rigaPro.id)
      .maybeSingle();
    const tier = (piano as { subscription_tier?: string } | null)?.subscription_tier;
    if (tier && tier !== "free") {
      out.push({
        id: "verifica:da-fare",
        livello: "azione",
        titolo: "Il tuo profilo non è verificato",
        testo:
          "Comunicando la partita IVA i clienti vedono l'etichetta Pro con la data del controllo: è il primo segnale di fiducia che guardano prima di scriverti. È inclusa nel tuo piano, bastano il numero e pochi secondi, e il numero non è mai visibile ai clienti.",
        href: "/impostazioni/verifica",
        azione: "Verifica ora",
        quando: null,
      });
    }
  }

  return ordina(out);
}

function ordina(n: Notifica[]): Notifica[] {
  return [...n].sort((a, b) => {
    const l = ORDINE_LIVELLO[a.livello] - ORDINE_LIVELLO[b.livello];
    if (l !== 0) return l;
    return (b.quando ?? "").localeCompare(a.quando ?? "");
  });
}

// ---------------------------------------------------------------------------
// «Letto»: una data sola nel browser
// ---------------------------------------------------------------------------

export const CHIAVE_VISTE = "bob.notifiche.viste.v1";
export const EVENTO_NOTIFICHE = "bob:notifiche-viste";

export function leggiViste(): string | null {
  try {
    return window.localStorage.getItem(CHIAVE_VISTE);
  } catch {
    return null;
  }
}

export function segnaViste(quando: Date = new Date()): void {
  try {
    window.localStorage.setItem(CHIAVE_VISTE, quando.toISOString());
  } catch {
    // Senza memoria il pallino resta acceso: fastidioso, non rotto.
  }
  try {
    window.dispatchEvent(new Event(EVENTO_NOTIFICHE));
  } catch {
    // Nessun listener, nessun problema.
  }
}

/**
 * Da contare sul pallino. Due categorie diverse, non una:
 * - le NOTIZIE (hanno una data) contano finché non le hai aperte;
 * - le COSE DA FARE contano finché non sono fatte, anche se le hai già viste.
 *   È il punto: un profilo che non compare nelle ricerche deve continuare a
 *   dare fastidio, non spegnersi perché hai guardato la campanella una volta.
 */
export function daVedere(n: Notifica, viste: string | null): boolean {
  if (n.livello === "azione") return true;
  if (!n.quando) return false;
  return !viste || n.quando > viste;
}
