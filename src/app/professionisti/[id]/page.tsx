import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProfessionalById,
  getProfessionalReviews,
  getPortfolioItems,
} from "@/lib/data";
import { Stars, VerificationLevelBadge, PriceTag } from "@/components/ui";
import { ContactButton } from "@/components/ContactButton";
import InstantBookingEntry from "@/components/InstantBookingEntry";
import { ServiceIcon } from "@/lib/serviceIcons";

// LA SCHEDA PUBBLICA — asciugata il 30/08.
//
// COM'ERA. Quattro riquadri incolonnati (intestazione, «CHI È», portfolio,
// «RECENSIONI») piu' la colonna del prezzo. Su un profilo appena iscritto tre
// di quei riquadri erano intestazioni sopra il vuoto: «RECENSIONI — Ancora
// nessuna recensione. Sii il primo a lavorare con X», che e' una riga di
// pubblicita' travestita da contenuto, e un paragrafo di tre righe sotto il
// badge che ripeteva a parole la data e il caveat gia' scritti dentro il badge
// stesso. Piu' testo, meno informazione: si scorreva senza leggere.
//
// COM'E' ADESSO. Un riquadro solo con tutto quello che serve a decidere se
// scrivere — chi e', che mestiere, dove, com'e' andata con gli altri, quanto
// costa — e le sezioni che compaiono solo quando hanno qualcosa dentro. Le
// recensioni assenti si dicono gia' nella riga dei dati («Ancora senza
// recensioni»): non serve un riquadro per ripeterlo.
//
// IL TITOLO E' IL NOME DELL'ATTIVITA' (065), non quello del titolare: il primo
// e' il motivo per cui il pro sta qui, il secondo e' un dato che serve a noi.
// Vedi displayName in lib/data.ts.

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const p = await getProfessionalById(params.id);
  if (!p) return { title: "Professionista non trovato" };
  return {
    title: `${p.displayName} — ${p.serviceName ?? "Professionista"} a ${p.city.name}`,
    description:
      p.bio ??
      `${p.displayName}, ${p.serviceName ?? "professionista"} a ${p.city.name}. Prezzi e disponibilità su BOB.`,
  };
}

function fmtDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
      // Questa pagina rende sul server (UTC): senza fuso esplicito la data
      // cambierebbe giorno rispetto a quella che vede il pro.
      timeZone: "Europe/Rome",
    });
  } catch {
    return "";
  }
}

export default async function ProfessionalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const p = await getProfessionalById(params.id);
  if (!p) notFound();

  const [reviews, portfolio] = await Promise.all([
    getProfessionalReviews(p.id),
    getPortfolioItems(p.id),
  ]);

  const initials = p.displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const primoNome = p.displayName.split(" ")[0];

  return (
    <div className="container-bob py-10 pb-28 lg:pb-10">
      <nav className="mb-4 text-sm text-bob-ink/50" aria-label="breadcrumb">
        <Link href="/professionisti" className="hover:text-bob-indigo">
          Professionisti
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-bob-ink/70">{p.displayName}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Colonna principale */}
        <div className="flex flex-col gap-6">
          {/* Un riquadro solo: chi è, cosa fa, dove, com'è andata, chi è. */}
          <header className="card p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-bob-indigo-100 text-xl font-bold text-bob-indigo">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-bob-ink sm:text-2xl">
                  {p.displayName}
                </h1>
                {p.headline && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-bob-ink/65">
                    {p.headline}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {p.serviceName && (
                    <Link
                      href={`/servizi/${p.serviceSlug}`}
                      className="chip hover:bg-bob-indigo-50"
                    >
                      <ServiceIcon
                        slug={p.serviceSlug ?? ""}
                        className="mr-1 h-4 w-4 text-bob-indigo"
                      />
                      {p.serviceName}
                    </Link>
                  )}
                  <Link
                    href={`/citta/${p.city.slug}`}
                    className="chip border-black/10 bg-black/[0.03] text-bob-ink/70 hover:bg-black/[0.06]"
                  >
                    {p.city.name}
                  </Link>
                </div>
              </div>
            </div>

            {/* La riga dei dati. Il badge porta già dentro di sé la data del
                riscontro e, nel tooltip, cosa attesta e cosa no: il paragrafo
                che lo ripeteva a parole è stato tolto. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/5 pt-4 text-sm text-bob-ink/60">
              <Stars value={p.avgRating} count={p.nRatings} size="md" />
              <VerificationLevelBadge
                level={p.verificationLevel}
                verifiedAt={p.verifiedAt}
              />
              {p.yearsExperience !== null && (
                <span>{p.yearsExperience} anni di esperienza</span>
              )}
              {p.responseTimeLabel && <span>{p.responseTimeLabel}</span>}
            </div>

            {/* Il "chi è" senza intestazione: il testo è già sotto il nome,
                non serve un'etichetta che dica che è una descrizione. */}
            {p.bio && (
              <p className="mt-4 border-t border-black/5 pt-4 text-sm leading-relaxed text-bob-ink/75">
                {p.bio}
              </p>
            )}
          </header>

          {/* Lavori conclusi: solo se ce ne sono (piani Pro/Business). */}
          {portfolio.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
                Lavori ({portfolio.length})
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {portfolio.map((item) => (
                  <li
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-black/5"
                    data-testid={`portfolio-${item.id}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt={item.title}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="p-2.5">
                      <p className="truncate text-xs font-semibold text-bob-ink">
                        {item.title}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recensioni: il riquadro esiste solo se ce n'è almeno una. Lo stato
              «ancora nessuna» è già nella riga dei dati qui sopra. */}
          {reviews.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
                Recensioni ({reviews.length})
              </h2>
              <ul className="flex flex-col gap-4">
                {reviews.map((r) => (
                  <li
                    key={r.id}
                    className="border-b border-black/5 pb-4 last:border-0 last:pb-0"
                    data-testid={`review-${r.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <Stars value={r.score} />
                      <span className="text-xs text-bob-ink/45">
                        {fmtDate(r.created_at)}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-2 text-sm text-bob-ink/75">{r.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Colonna laterale: prezzo + contatto (sticky su desktop) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <InstantBookingEntry
            professionalId={p.id}
            professionalName={p.displayName}
          />
          <div className="card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-bob-ink/50">
              Costo indicativo
            </p>
            <div className="mt-1.5 text-2xl">
              <PriceTag min={p.minPrice} max={p.maxPrice} />
            </div>
            {p.priceNote && (
              <p className="mt-1 line-clamp-2 text-xs text-bob-ink/55">
                {p.priceNote}
              </p>
            )}

            <div className="mt-5">
              <ContactButton
                professional={p}
                className="btn-primary w-full py-3"
                label={`Contatta ${primoNome}`}
              />
            </div>
            <p className="mt-3 text-center text-xs text-bob-ink/45">
              Scrivere è gratis: la fee solo a lavoro concluso.
            </p>
          </div>
        </aside>
      </div>

      {/* Barra contatto fissa in basso su mobile: il CTA principale resta sempre visibile */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 shrink-0 text-base font-semibold">
            <PriceTag min={p.minPrice} max={p.maxPrice} />
          </div>
          <ContactButton
            professional={p}
            className="btn-primary min-w-0 flex-1 py-3"
            label={`Contatta ${primoNome}`}
          />
        </div>
      </div>
    </div>
  );
}
