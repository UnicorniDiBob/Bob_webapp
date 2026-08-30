"use client";

// LO STATO DEL PROFILO, IN CHIARO.
//
// DUE COSE DIVERSE, TENUTE SEPARATE APPOSTA.
//
// 1. «Compari nelle ricerche» e' uno STATO DEL SERVER: professionals.ready_at,
//    scritta dai trigger della 062 e da nessun altro — il client non puo'
//    dichiararsi pronto, il trigger della 057 glielo rifiuta. Si accende quando
//    esiste almeno un servizio e il profilo non e' disattivato, cioe' esattamente
//    quando getProfessionals() (src/lib/data.ts) puo' restituirlo: quel filtro
//    passa per serviceSlug, preso dalla prima riga di professional_services.
//    Finche' la 062 non e' applicata la colonna e' NULL per tutti, e allora vale
//    il calcolo locale: meglio una rete che un riquadro che dice «non compari» a
//    chi compare.
//
// 2. La CHECKLIST delle quattro cose e' un controllo fatto qui, adesso, sulle
//    tabelle del professionista. Serve a dire cosa manca, non chi e' pronto.
//    Zone, orari e telefono non nascondono nessuno: cambiano quanto lontano
//    arrivi, a che ora ti proponiamo, se ti possono chiamare. Vanno dette per
//    quello che fanno — una lista che minaccia su tutto insegna a ignorarla.
//    Il telefono in particolare non puo' diventare un requisito finche' le
//    chiamate non esistono nel prodotto (deciso il 29/08).

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dovesiSistema, motivoInvisibile } from "@/lib/notifiche";

export type ChiaveStato = "servizi" | "zone" | "telefono" | "orari";

export interface VoceStato {
  chiave: ChiaveStato;
  fatto: boolean;
  titolo: string;
  /** Cosa succede davvero se manca. Niente minacce generiche. */
  conseguenza: string;
  /** La pagina dove si sistema. */
  href: string;
  /** Nome della tabella: finisce in un title=, per poter verificare. */
  tabella: string;
  /** true = senza questo non compare in nessuna ricerca filtrata. */
  blocca: boolean;
}

export interface StatoProfilo {
  voci: VoceStato[];
  /** Compare nelle ricerche: dipende SOLO dalle voci bloccanti. */
  compare: boolean;
  /**
   * PERCHE' non compare, in una frase leggibile. null quando compare.
   * La frase nasce in lib/notifiche.ts (motivoInvisibile) perche' la stessa
   * spiegazione va detta identica qui, nella campanella e nel promemoria: tre
   * copie divergono, una sola no.
   */
  motivo: string | null;
  /** La pagina dove si toglie il motivo qui sopra. */
  hrefMotivo: string;
  /**
   * professionals.ready_at: da quando il server dichiara il profilo trovabile.
   * La scrivono i trigger della 062, mai il client. NULL finche' la migrazione
   * non e' applicata, oppure quando la condizione non e' soddisfatta.
   */
  readyAt: string | null;
  /** Quante voci mancano in tutto, bloccanti o no. */
  mancanti: number;
  /** L'ora in cui la checklist e' stata controllata. */
  letto: Date;
}

export type EsitoStato =
  | { fase: "carico" }
  | { fase: "letto"; stato: StatoProfilo }
  | { fase: "irraggiungibile" };

const TESTI: Record<ChiaveStato, Omit<VoceStato, "fatto">> = {
  servizi: {
    chiave: "servizi",
    titolo: "Cosa fai",
    conseguenza:
      "Senza, non compari in nessuna ricerca: gli elenchi filtrano per servizio e il tuo è vuoto.",
    href: "/impostazioni/azienda",
    tabella: "professional_services",
    blocca: true,
  },
  zone: {
    chiave: "zone",
    titolo: "Dove lavori",
    conseguenza:
      "Senza, vali per la sola città in cui ti sei iscritto: nessun quartiere, nessuna provincia.",
    href: "/impostazioni/zone",
    tabella: "professional_coverage",
    blocca: false,
  },
  telefono: {
    chiave: "telefono",
    titolo: "Il tuo numero",
    conseguenza:
      "Non lo vede il cliente: serve a noi per farti arrivare le chiamate e per la prenotazione diretta.",
    href: "/impostazioni/dati",
    tabella: "profile_phone",
    blocca: false,
  },
  orari: {
    chiave: "orari",
    titolo: "I tuoi orari",
    conseguenza:
      "Senza, proponiamo ai clienti orari standard — e possono essere ore in cui non lavori.",
    href: "/impostazioni/orari",
    tabella: "professional_availability",
    blocca: false,
  },
};

export function useStatoProfilo(
  professionalId: string | null,
  userId: string | null
) {
  const supabase = createClient();
  const [esito, setEsito] = useState<EsitoStato>({ fase: "carico" });

  const rileggi = useCallback(async () => {
    if (!professionalId || !userId) return;
    setEsito({ fase: "carico" });

    // Se la lettura non torna, non si resta a girare: dopo sei secondi si dice
    // che non si e' potuto controllare. Uno spinner eterno e' il modo piu'
    // sicuro di far ignorare il riquadro.
    let finito = false;
    const scaduto = setTimeout(() => {
      if (!finito) setEsito({ fase: "irraggiungibile" });
    }, 6000);

    try {
      const [servizi, zone, telefono, orari, riga] = await Promise.all([
        supabase
          .from("professional_services")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", professionalId),
        supabase
          .from("professional_coverage")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", professionalId),
        supabase
          .from("profile_phone")
          .select("phone")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("professional_availability")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", professionalId),
        supabase
          .from("professionals")
          .select("ready_at, deactivated_at")
          .eq("id", professionalId)
          .maybeSingle(),
      ]);

      // ATTENZIONE: supabase-js NON lancia quando la lettura fallisce, torna un
      // oggetto con .error e i conteggi a null. Senza questo controllo una rete
      // caduta diventa «ti mancano 4 cose» a chi non gli manca niente: visto
      // succedere davvero, con la rete bloccata.
      if (servizi.error || zone.error || telefono.error || orari.error || riga.error) {
        setEsito({ fase: "irraggiungibile" });
        return;
      }

      const fatti: Record<ChiaveStato, boolean> = {
        servizi: (servizi.count ?? 0) > 0,
        zone: (zone.count ?? 0) > 0,
        telefono: Boolean((telefono.data as { phone?: string } | null)?.phone),
        orari: (orari.count ?? 0) > 0,
      };

      const voci: VoceStato[] = (
        ["servizi", "zone", "telefono", "orari"] as ChiaveStato[]
      ).map((k) => ({ ...TESTI[k], fatto: fatti[k] }));

      const profilo = (riga.data ?? {}) as {
        ready_at?: string | null;
        deactivated_at?: string | null;
      };
      const readyAt = profilo.ready_at ?? null;

      // Chi comanda e' il server, quando ha parlato. Il calcolo locale resta
      // come rete: finche' la 062 non e' applicata ready_at e' NULL per tutti, e
      // un riquadro che dicesse «non compari» a chi compare sarebbe peggio del
      // problema che stiamo risolvendo.
      const compare = readyAt
        ? true
        : fatti.servizi && !profilo.deactivated_at;

      // Il motivo si calcola SEMPRE dai fatti, anche quando ready_at dice che
      // compare: se i due non fossero d'accordo (trigger fermo, riga scritta a
      // mano) meglio accorgersene qui che dal professionista.
      const fattiVisibilita = {
        servizi: servizi.count ?? 0,
        disattivato: Boolean(profilo.deactivated_at),
      };

      setEsito({
        fase: "letto",
        stato: {
          voci,
          compare,
          motivo: compare ? null : motivoInvisibile(fattiVisibilita),
          hrefMotivo: dovesiSistema(fattiVisibilita),
          readyAt,
          mancanti: voci.filter((v) => !v.fatto).length,
          letto: new Date(),
        },
      });
    } catch {
      setEsito({ fase: "irraggiungibile" });
    } finally {
      finito = true;
      clearTimeout(scaduto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId, userId]);

  useEffect(() => {
    rileggi();
  }, [rileggi]);

  return { esito, rileggi };
}
