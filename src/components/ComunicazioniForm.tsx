"use client";

// Sezione "Comunicazioni": due elenchi che NON sono la stessa cosa.
//
// IL PUNTO DI QUESTA PAGINA
// In alto le comunicazioni di SERVIZIO. Non hanno una spunta perche' non sono
// un consenso: la base giuridica e' l'esecuzione del contratto (art. 6.1.b
// GDPR). Sono dovute, e finche' l'account e' attivo non si disattivano — un
// "nuovo messaggio da un cliente" che si puo' spegnere non e' una preferenza,
// e' un servizio rotto. Elencarle una per una serve a rendere vero il
// contrario di quello che sembra: non stiamo negando una scelta, stiamo
// dicendo esattamente cosa arriva e perche'.
//
// In basso le comunicazioni COMMERCIALI. Una spunta per finalita', spente per
// default, revocabili in un clic. Niente soft opt-in: iscriversi a Bob non e'
// un acquisto e non autorizza niente (regola di progetto, e il caso Verisure
// dice quanto costa il contrario). Ogni cambio scrive una riga nuova in
// communication_consents: la revoca non cancella il consenso precedente,
// perche' la storia e' l'unica cosa che dimostra quando il consenso c'era.
//
// PERCHE' NON C'E' UNA SPUNTA "ACCETTO LE COMUNICAZIONI" LEGATA ALLA VERIFICA
// Sarebbe nulla. Un consenso che condiziona un servizio che non ne ha bisogno
// non e' libero (art. 7(4) GDPR), e un consenso non libero non e' un consenso:
// il risultato sarebbe restare senza base giuridica per quelle email, cioe'
// peggio di non averle chieste. Cio' che serve davvero — un professionista
// raggiungibile — si ottiene chiedendo un'email confermata, che e' un
// requisito tecnico legittimo. Vedi /dashboard/verifica.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { SectionHeader } from "@/components/DashboardShell";
import { SectionSkeleton, SectionError } from "@/components/SectionStates";

type Finalita = "bob_news" | "partner_offers";

interface VoceConsenso {
  id: Finalita;
  titolo: string;
  spiegazione: string;
  /** Alcune finalita' hanno senso solo per un ruolo. */
  soloPro?: boolean;
}

const COMMERCIALI: VoceConsenso[] = [
  {
    id: "bob_news",
    titolo: "Novità di Bob",
    spiegazione:
      "Quando aggiungiamo qualcosa che ti riguarda davvero: una funzione nuova, un cambio nei piani, una guida utile. Poche, e mai per riempire il calendario.",
  },
  {
    id: "partner_offers",
    titolo: "Offerte dei partner",
    spiegazione:
      "Servizi per chi lavora in proprio: commercialista, assicurazione, strumenti. Il tuo indirizzo non lo diamo a nessuno — se c'è qualcosa, te lo scriviamo noi.",
    soloPro: true,
  },
];

// Le comunicazioni di servizio, in chiaro. L'elenco corrisponde ai punti in
// cui il codice chiama la pipeline (src/lib/email.ts): se se ne aggiunge una,
// va aggiunta anche qui, altrimenti questa pagina diventa una bugia.
const SERVIZIO: { titolo: string; quando: string }[] = [
  {
    titolo: "Una nuova richiesta ti riguarda",
    quando: "Quando un cliente ti sceglie o chiede un preventivo.",
  },
  {
    titolo: "Hai un nuovo messaggio",
    quando: "Quando un cliente ti scrive in una conversazione aperta.",
  },
  {
    titolo: "Un appuntamento cambia",
    quando: "Proposta, conferma, spostamento o annullamento.",
  },
  {
    titolo: "L'esito della tua verifica",
    quando:
      "Quando la partita IVA è confermata, quando serve un documento, quando c'è una decisione.",
  },
  {
    titolo: "Sicurezza dell'account",
    quando: "Reimpostazione della password e cambio dell'indirizzo email.",
  },
];

export function ComunicazioniForm({ emailAttive }: { emailAttive: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();

  const [stato, setStato] = useState<
    Partial<Record<Finalita, { granted: boolean; at: string }>>
  >({});
  const [booted, setBooted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Finalita | null>(null);

  const isPro = role === "professional";
  const voci = COMMERCIALI.filter((v) => !v.soloPro || isPro);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    const { data, error } = await supabase
      .from("communication_consents")
      .select("purpose, granted, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setFailed(true);
      setBooted(true);
      return;
    }

    // Lo stato corrente di una finalita' e' la riga piu' recente: la query
    // arriva ordinata dal piu' nuovo, quindi la prima che si incontra vince.
    const corrente: Partial<Record<Finalita, { granted: boolean; at: string }>> = {};
    for (const r of (data ?? []) as {
      purpose: Finalita;
      granted: boolean;
      created_at: string;
    }[]) {
      if (!corrente[r.purpose])
        corrente[r.purpose] = { granted: r.granted, at: r.created_at };
    }
    setStato(corrente);
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Guardia di autenticazione, aggiunta il 19/08 dopo il controllo dal vivo.
  // Era l'unica sezione senza: le altre otto hanno questo redirect nella
  // pagina, questa e' l'unica costruita come pagina server + form client e la
  // guardia era rimasta fuori. Chi arrivava qui senza sessione vedeva la
  // pagina intera con i due interruttori spenti, e cliccandoli non succedeva
  // niente in silenzio — nessun dato esposto (cambia() esce subito senza
  // utente, e la RLS regge comunque), ma uno schermo che finisce nel vuoto.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?returnTo=/dashboard/comunicazioni");
      return;
    }
    load();
  }, [authLoading, user, load, router]);

  async function cambia(voce: VoceConsenso, nuovo: boolean) {
    if (!user || busy) return;
    setBusy(voce.id);
    // Riga nuova, non aggiornamento: il registro e' in sola aggiunta.
    const { error } = await supabase.from("communication_consents").insert({
      user_id: user.id,
      purpose: voce.id,
      granted: nuovo,
      // Il testo che aveva davanti quando ha scelto: e' cio' che rende il
      // consenso dimostrabile quando il testo del form sara' cambiato.
      consent_text: `${voce.titolo} — ${voce.spiegazione}`,
      source: "dashboard",
    });
    if (!error) await load();
    setBusy(null);
  }

  if (authLoading || !booted) return <SectionSkeleton rows={3} />;
  if (failed) return <SectionError onRetry={load} />;

  return (
    <div className="space-y-5">
      <SectionHeader title="Comunicazioni">
        Cosa ti scriviamo, quando, e cosa puoi spegnere. Le due cose qui sotto
        sono diverse fra loro, e la differenza conta.
      </SectionHeader>

      {/* Se la pipeline e' spenta lo diciamo qui, invece di elencare email che
          non partono. Il valore arriva dal server: quando la chiave Resend c'e',
          questo avviso scompare da solo. */}
      {!emailAttive && (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
          data-testid="email-non-attive"
        >
          <p className="text-sm leading-relaxed text-amber-900">
            <strong>Le email non partono ancora.</strong> Stiamo completando la
            configurazione del dominio di invio: fino ad allora le
            comunicazioni qui sotto le trovi solo dentro Bob, non nella tua
            casella. Le tue scelte le registriamo comunque da subito.
          </p>
        </div>
      )}

      {/* --- Comunicazioni di servizio: nessuna spunta, e si spiega perche' --- */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-bob-ink">
          Comunicazioni di servizio
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
          Fanno parte del servizio: sono il modo in cui sai che è successo
          qualcosa. Non hanno una spunta perché non sono pubblicità e non
          chiediamo il tuo permesso per mandartele — le riceverai finché il tuo
          account è attivo. Non contengono offerte.
        </p>
        <ul className="mt-4 divide-y divide-black/5 border-t border-black/5">
          {SERVIZIO.map((s) => (
            <li key={s.titolo} className="py-3">
              <p className="text-sm font-medium text-bob-ink">{s.titolo}</p>
              <p className="mt-0.5 text-sm text-bob-ink/55">{s.quando}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-bob-ink/45">
          Se non vuoi più riceverle, la strada è chiudere l&apos;account: le
          trovi in{" "}
          <Link
            href="/dashboard/accesso"
            className="font-medium text-bob-indigo hover:underline"
          >
            Accesso e sicurezza
          </Link>
          .
        </p>
      </div>

      {/* --- Comunicazioni commerciali: una spunta per finalita' --- */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-bob-ink">
          Comunicazioni commerciali
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
          Queste sì, e solo se le vuoi. Sono spente per scelta nostra: nessuna è
          attiva perché ti sei iscritto. Puoi cambiare idea quando vuoi, in
          entrambe le direzioni, e non cambia nulla del servizio.
        </p>

        <ul className="mt-4 space-y-3 border-t border-black/5 pt-4">
          {voci.map((v) => {
            const s = stato[v.id];
            const acceso = Boolean(s?.granted);
            return (
              <li
                key={v.id}
                className="rounded-xl border border-black/[0.07] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-bob-ink">
                      {v.titolo}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-bob-ink/60">
                      {v.spiegazione}
                    </p>
                    {s && (
                      <p className="mt-2 text-xs text-bob-ink/45">
                        {acceso ? "Attivata" : "Disattivata"} il{" "}
                        {new Date(s.at).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        .
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={acceso}
                    aria-label={`${acceso ? "Disattiva" : "Attiva"} ${v.titolo}`}
                    disabled={busy === v.id}
                    onClick={() => cambia(v, !acceso)}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                      acceso ? "bg-bob-indigo" : "bg-black/15"
                    }`}
                    data-testid={`consenso-${v.id}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        acceso ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-bob-ink/45">
          Registriamo ogni scelta con la data e il testo che avevi davanti:
          serve a noi per dimostrare che il consenso c&apos;era, e a te per
          sapere cosa hai accettato. I dettagli nell&apos;
          <Link
            href="/privacy"
            className="font-medium text-bob-indigo hover:underline"
          >
            informativa privacy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
