"use client";

// Il pannello degli avvisi di servizio: scrivi, programma, spegni.
//
// TRE COSE CHE QUESTA PAGINA FA APPOSTA.
//
// 1. Mostra l'anteprima di com'e' scritto PRIMA di pubblicare. Un avviso lo
//    leggono tutti e non si puo' richiamare indietro: vederlo com'e' costa
//    niente e evita il refuso su tutti gli schermi.
// 2. Chiede sempre una data di fine. Un avviso senza scadenza resta li' finche'
//    qualcuno se ne ricorda, e nessuno se ne ricorda mai — e' cosi' che una
//    manutenzione di tre settimane fa e' ancora in cima al sito.
// 3. «Spegni adesso» non cancella: sposta la fine a ora. L'avviso resta come
//    prova di cosa abbiamo detto e quando (la 071 li tiene 24 mesi).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, Info, AlertTriangle, OctagonAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ETICHETTA_AVVISO, type LivelloAvviso } from "@/lib/avvisi";

interface Riga {
  id: string;
  titolo: string;
  testo: string;
  livello: LivelloAvviso;
  inizio_il: string;
  fine_il: string;
  creato_il: string;
}

const LIVELLI: { valore: LivelloAvviso; spiega: string }[] = [
  {
    valore: "informazione",
    spiega: "Una novità o un cambiamento. Nessuno deve fare niente.",
  },
  {
    valore: "attenzione",
    spiega: "Sta per succedere qualcosa che conviene sapere prima.",
  },
  {
    valore: "disservizio",
    spiega:
      "Qualcosa non funziona o sta per fermarsi. Resta acceso sulla campanella finché dura.",
  },
];

const ICONA = {
  informazione: Info,
  attenzione: AlertTriangle,
  disservizio: OctagonAlert,
} as const;

/** Il valore che vuole <input type="datetime-local">: ora locale, senza fuso. */
function perInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

function leggibile(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stato(r: Riga): { testo: string; classe: string } {
  const ora = Date.now();
  if (new Date(r.fine_il).getTime() <= ora) {
    return { testo: "Finito", classe: "bg-black/5 text-bob-ink/50" };
  }
  if (new Date(r.inizio_il).getTime() > ora) {
    return { testo: "Programmato", classe: "bg-amber-50 text-amber-700" };
  }
  return { testo: "In corso", classe: "bg-emerald-50 text-emerald-700" };
}

export function AvvisiAdmin() {
  const supabase = createClient();
  const { user } = useAuth();

  const [righe, setRighe] = useState<Riga[]>([]);
  const [caricate, setCaricate] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [titolo, setTitolo] = useState("");
  const [testo, setTesto] = useState("");
  const [livello, setLivello] = useState<LivelloAvviso>("informazione");
  const [inizio, setInizio] = useState(() => perInput(new Date()));
  const [fine, setFine] = useState(() =>
    perInput(new Date(Date.now() + 24 * 3600 * 1000))
  );
  const [salvando, setSalvando] = useState(false);

  const carica = useCallback(async () => {
    const { data, error } = await supabase
      .from("avvisi_servizio")
      .select("id, titolo, testo, livello, inizio_il, fine_il, creato_il")
      .order("inizio_il", { ascending: false })
      .limit(50);
    if (error) {
      setErrore("Non riesco a leggere gli avvisi. Ricarica la pagina.");
      setCaricate(true);
      return;
    }
    setRighe((data ?? []) as Riga[]);
    setCaricate(true);
  }, [supabase]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const titoloPulito = titolo.trim();
  const testoPulito = testo.trim();
  const inizioData = useMemo(() => new Date(inizio), [inizio]);
  const fineData = useMemo(() => new Date(fine), [fine]);

  const problema: string | null = (() => {
    if (titoloPulito.length < 3) return "Il titolo è troppo corto.";
    if (titoloPulito.length > 120) return "Il titolo supera i 120 caratteri.";
    if (testoPulito.length < 3) return "Il testo è troppo corto.";
    if (testoPulito.length > 2000) return "Il testo supera i 2000 caratteri.";
    if (isNaN(inizioData.getTime()) || isNaN(fineData.getTime())) {
      return "Le date non sono valide.";
    }
    if (fineData <= inizioData) return "La fine deve venire dopo l'inizio.";
    return null;
  })();

  async function pubblica() {
    if (problema || salvando || !user) return;
    setSalvando(true);
    setErrore(null);
    const { error } = await supabase.from("avvisi_servizio").insert({
      titolo: titoloPulito,
      testo: testoPulito,
      livello,
      inizio_il: inizioData.toISOString(),
      fine_il: fineData.toISOString(),
      creato_da: user.id,
    });
    if (error) {
      setErrore("Non sono riuscito a pubblicarlo. Riprova.");
      setSalvando(false);
      return;
    }
    setTitolo("");
    setTesto("");
    setLivello("informazione");
    await carica();
    setSalvando(false);
  }

  async function spegni(r: Riga) {
    setErrore(null);
    const { error } = await supabase
      .from("avvisi_servizio")
      .update({
        fine_il: new Date().toISOString(),
        aggiornato_il: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) {
      setErrore("Non sono riuscito a spegnerlo. Riprova.");
      return;
    }
    await carica();
  }

  const Anteprima = ICONA[livello];

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <span className="section-eyebrow">Admin</span>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-bob-ink">
          <Megaphone className="h-6 w-6 text-bob-ink/40" aria-hidden="true" />
          Avvisi di servizio
        </h1>
        <p className="mt-1.5 text-sm text-bob-ink/60">
          Quello che scrivi qui lo vedono tutti gli utenti registrati: una
          finestra al primo accesso, poi nella campanella, finché non scade.
          Non si può richiamare indietro — si può solo spegnere.
        </p>
      </header>

      {errore && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {errore}
        </p>
      )}

      {/* --- scrivi --- */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-bob-ink">Nuovo avviso</h2>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="label-bob" htmlFor="avviso-titolo">
              Titolo
            </label>
            <input
              id="avviso-titolo"
              className="input-bob"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Manutenzione programmata"
              maxLength={120}
            />
          </div>

          <div>
            <label className="label-bob" htmlFor="avviso-testo">
              Testo
            </label>
            <textarea
              id="avviso-testo"
              className="input-bob min-h-[110px] resize-y"
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder="Lunedì dalle 3:00 alle 4:00 il sito non sarà raggiungibile. Le richieste già inviate non si perdono."
              maxLength={2000}
            />
            <p className="mt-1 text-xs text-bob-ink/45">
              {testoPulito.length}/2000 · gli a capo si vedono come li scrivi.
            </p>
          </div>

          <fieldset>
            <legend className="label-bob">Che tipo di avviso è</legend>
            <div className="mt-1 flex flex-col gap-1.5">
              {LIVELLI.map((l) => (
                <label
                  key={l.valore}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                    livello === l.valore
                      ? "border-bob-indigo/40 bg-bob-indigo-50/50"
                      : "border-black/10 hover:bg-black/[0.02]"
                  }`}
                >
                  <input
                    type="radio"
                    name="livello"
                    className="mt-0.5"
                    checked={livello === l.valore}
                    onChange={() => setLivello(l.valore)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-bob-ink">
                      {ETICHETTA_AVVISO[l.valore]}
                    </span>
                    <span className="block text-xs text-bob-ink/55">
                      {l.spiega}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-bob" htmlFor="avviso-inizio">
                Da quando
              </label>
              <input
                id="avviso-inizio"
                type="datetime-local"
                className="input-bob"
                value={inizio}
                onChange={(e) => setInizio(e.target.value)}
              />
            </div>
            <div>
              <label className="label-bob" htmlFor="avviso-fine">
                Fino a quando
              </label>
              <input
                id="avviso-fine"
                type="datetime-local"
                className="input-bob"
                value={fine}
                onChange={(e) => setFine(e.target.value)}
              />
              <p className="mt-1 text-xs text-bob-ink/45">
                Da qui in poi sparisce da solo, da tutti.
              </p>
            </div>
          </div>

          {/* Anteprima: com'è scritto, prima che lo legga qualcun altro. */}
          {(titoloPulito || testoPulito) && (
            <div>
              <p className="label-bob">Come lo vedono</p>
              <div className="mt-1 rounded-xl border border-black/10 bg-black/[0.015] p-3.5">
                <p className="flex items-start gap-2 text-sm font-semibold text-bob-ink">
                  <Anteprima
                    className="mt-0.5 h-4 w-4 shrink-0 text-bob-ink/50"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    {titoloPulito || "(titolo)"}
                  </span>
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-bob-ink/75">
                  {testoPulito || "(testo)"}
                </p>
              </div>
            </div>
          )}

          {problema && (titoloPulito || testoPulito) && (
            <p className="text-sm text-amber-700">{problema}</p>
          )}

          <div>
            <button
              type="button"
              onClick={pubblica}
              disabled={Boolean(problema) || salvando}
              className="btn-primary py-2.5 disabled:opacity-50"
              data-testid="avviso-pubblica"
            >
              {salvando ? "Pubblico…" : "Pubblica per tutti"}
            </button>
          </div>
        </div>
      </section>

      {/* --- elenco --- */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
          Gli ultimi avvisi
        </h2>
        {!caricate ? (
          <p className="text-sm text-bob-ink/50">Carico…</p>
        ) : righe.length === 0 ? (
          <div className="card p-6 text-sm text-bob-ink/55">
            Non ne è ancora stato pubblicato nessuno.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {righe.map((r) => {
              const s = stato(r);
              const attivo = s.testo !== "Finito";
              return (
                <li
                  key={r.id}
                  className="card flex items-start gap-3 px-4 py-3"
                  data-testid={`avviso-riga-${r.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-bob-ink">
                        {r.titolo}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.classe}`}
                      >
                        {s.testo}
                      </span>
                      <span className="text-[11px] text-bob-ink/45">
                        {ETICHETTA_AVVISO[r.livello]}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-bob-ink/65">
                      {r.testo}
                    </p>
                    <p className="mt-1 text-xs text-bob-ink/45">
                      {leggibile(r.inizio_il)} → {leggibile(r.fine_il)}
                    </p>
                  </div>
                  {attivo && (
                    <button
                      type="button"
                      onClick={() => spegni(r)}
                      className="shrink-0 rounded-xl border border-black/10 px-3 py-1.5 text-xs font-medium text-bob-ink/60 hover:border-red-300 hover:text-red-600"
                      data-testid={`avviso-spegni-${r.id}`}
                    >
                      Spegni adesso
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
