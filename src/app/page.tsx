import Link from "next/link";
import {
  getCities,
  getServices,
  getProfessionals,
  getServiceCounts,
} from "@/lib/data";
import { BobChat } from "@/components/BobChat";
import { ProfessionalCardItem } from "@/components/ui";
import { Faq } from "@/components/Faq";
import { HOME_FAQ } from "@/lib/faqData";
import { ServiceIcon } from "@/lib/serviceIcons";

export const revalidate = 120;

export default async function HomePage() {
  const [cities, services, professionals, serviceCounts] = await Promise.all([
    getCities(),
    getServices(),
    getProfessionals(),
    getServiceCounts(),
  ]);

  const activeCities = cities.filter((c) => c.status === "active");
  const featuredServices = services.slice(0, 8);
  const featuredPros = professionals.slice(0, 4);
  const verifiedCount = professionals.filter(
    (p) => p.verificationStatus === "verified"
  ).length;

  return (
    <>
      {/* 2. HERO con Bob concierge */}
      <section id="bob" className="relative overflow-hidden border-b border-black/5 bg-gradient-to-b from-bob-indigo-50/70 to-transparent scroll-mt-20">
        <div className="container-bob grid grid-cols-1 items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
          <div className="animate-fade-up">
            <span className="chip mb-4">Pilota attivo a Milano</span>
            <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-bob-ink sm:text-4xl lg:text-[2.75rem]">
              Raccontami il problema.
              <br />
              <span className="text-bob-indigo">
                Ti aiuto a capire chi contattare.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-bob-ink/65">
              Sono Bob, il concierge dei servizi locali. Più chiarezza su
              prezzo, disponibilità e qualità — e nessuna fee per usarmi come
              cliente.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-bob-ink/55">
              <span className="inline-flex items-center gap-1.5">
                <Dot /> Prezzi trasparenti
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Dot /> Niente lead a pagamento
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Dot /> Messaggio scritto da Bob
              </span>
            </div>
          </div>

          <div className="animate-fade-up [animation-delay:80ms]">
            <BobChat cities={cities} services={services} />
          </div>
        </div>
      </section>

      {/* 3. COME FUNZIONA */}
      <section className="container-bob py-14">
        <SectionHead
          eyebrow="Come funziona"
          title="Quattro passi, zero attrito"
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "1", t: "Racconti il problema", d: "Scrivi a Bob con parole tue, anche se non sai quale professionista cercare." },
            { n: "2", t: "Bob capisce il contesto", d: "Ti chiede zona, urgenza e budget per filtrare i profili più rilevanti." },
            { n: "3", t: "Vedi i professionisti adatti", d: "Con rating, tempi di risposta e tariffa visibile nella scheda." },
            { n: "4", t: "Invii un messaggio pronto", d: "Bob scrive per te il primo contatto: lo invii a uno o più professionisti." },
          ].map((s) => (
            <div key={s.n} className="card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-bob-indigo text-sm font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-3 font-semibold text-bob-ink">{s.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-bob-ink/60">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/come-funziona" className="btn-ghost">
            Vedi tutti i dettagli →
          </Link>
        </div>
      </section>

      {/* 4. CITTÀ */}
      <section className="bg-white py-14">
        <div className="container-bob">
          <SectionHead eyebrow="Città" title="Dove sono operativo" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {cities.map((c) => {
              const active = c.status === "active";
              return (
                <Link
                  key={c.id}
                  href={`/citta/${c.slug}`}
                  className="card flex items-center justify-between p-5 hover:-translate-y-0.5 hover:shadow-card-hover"
                  data-testid={`card-city-${c.slug}`}
                >
                  <div>
                    <h3 className="font-semibold text-bob-ink">{c.name}</h3>
                    <p className="text-sm text-bob-ink/55">
                      {active
                        ? "Professionisti disponibili"
                        : "In arrivo · lascia il tuo interesse"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-black/5 text-bob-ink/50"
                    }`}
                  >
                    {active ? "Attiva" : "Coming soon"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. SERVIZI */}
      <section className="container-bob py-14">
        <SectionHead
          eyebrow="Servizi"
          title="Cosa posso aiutarti a trovare"
          action={{ href: "/servizi", label: "Esplora tutti i servizi" }}
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featuredServices.map((s) => (
            <Link
              key={s.id}
              href={`/servizi/${s.slug}`}
              className="card flex flex-col gap-2 p-5 hover:-translate-y-0.5 hover:shadow-card-hover"
              data-testid={`card-service-${s.slug}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bob-indigo-50 text-bob-indigo">
                <ServiceIcon slug={s.slug} className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-bob-ink">{s.name}</h3>
              <p className="text-xs text-bob-ink/50">
                {serviceCounts[s.id]
                  ? `${serviceCounts[s.id]} professionist${serviceCounts[s.id] === 1 ? "a" : "i"}`
                  : "In crescita"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* 6. ELENCO PROFESSIONISTI / accesso manuale */}
      <section className="bg-white py-14">
        <div className="container-bob">
          <SectionHead
            eyebrow="Professionisti"
            title="Preferisci cercare da solo?"
            subtitle="Puoi sfogliare i professionisti senza passare dalla chat. Il costo è sempre visibile nella scheda."
            action={{ href: "/professionisti", label: "Vedi tutti" }}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredPros.map((p) => (
              <ProfessionalCardItem key={p.id} p={p} />
            ))}
          </div>
        </div>
      </section>

      {/* 7. TRUST SIGNALS */}
      <section className="container-bob py-14">
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-black/5 bg-bob-indigo p-8 text-white sm:grid-cols-3">
          <Trust value={`${activeCities.length}`} label="Città presidiata nel pilota" />
          <Trust value={`${professionals.length}`} label="Professionisti nel pilota" />
          <Trust value={`${verifiedCount}`} label="Profili già verificati" />
        </div>
        <p className="mt-3 text-center text-xs text-bob-ink/45">
          Mostriamo solo numeri reali del pilota. Niente promesse gonfiate.
        </p>
      </section>

      {/* 8. PREMIUM IN ARRIVO */}
      <section className="bg-white py-14">
        <div className="container-bob">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-bob-indigo/30 bg-bob-indigo-50/50 p-6 sm:flex-row sm:items-center">
            <div>
              <span className="section-eyebrow">In arrivo</span>
              <h3 className="mt-1 text-lg font-semibold text-bob-ink">
                Servizi premium per i clienti
              </h3>
              <p className="mt-1 max-w-xl text-sm text-bob-ink/60">
                In futuro potrai prenotare direttamente alcune categorie e
                vedere l&apos;agenda dei professionisti. Per ora il servizio base
                resta gratuito.
              </p>
            </div>
            <span className="chip shrink-0">Presto disponibile</span>
          </div>
        </div>
      </section>

      {/* 9. FAQ */}
      <section className="container-bob py-14">
        <SectionHead eyebrow="FAQ" title="Le domande più frequenti" />
        <Faq items={HOME_FAQ} />
        <div className="mt-6 text-center">
          <Link href="/faq" className="btn-ghost">
            Tutte le FAQ →
          </Link>
        </div>
      </section>
    </>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-bob-yellow" />;
}

function Trust({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-sm text-white/75">{label}</p>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="section-eyebrow">{eyebrow}</span>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm text-bob-ink/60">{subtitle}</p>
        )}
      </div>
      {action && (
        <Link href={action.href} className="btn-secondary py-2 text-sm">
          {action.label}
        </Link>
      )}
    </div>
  );
}
