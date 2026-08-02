import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProfessionalById,
  getProfessionalReviews,
  getPortfolioItems,
} from "@/lib/data";
import {
  Stars,
  VerificationLevelBadge,
  PriceTag,
} from "@/components/ui";
import { ContactButton } from "@/components/ContactButton";
import InstantBookingEntry from "@/components/InstantBookingEntry";
import { ServiceIcon } from "@/lib/serviceIcons";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const p = await getProfessionalById(params.id);
  if (!p) return { title: "Professionista non trovato" };
  return {
    title: `${p.fullName} — ${p.serviceName ?? "Professionista"} a ${p.city.name}`,
    description:
      p.bio ??
      `${p.fullName}, ${p.serviceName ?? "professionista"} a ${p.city.name}. Prezzi e disponibilità su BOB.`,
  };
}

function fmtDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
      // Questa pagina rende sul server (UTC): senza fuso esplicito la data del
      // controllo cambierebbe giorno rispetto a quella che vede il pro.
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

  const initials = p.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="container-bob py-10 pb-28 lg:pb-10">
      <nav className="mb-4 text-sm text-bob-ink/50" aria-label="breadcrumb">
        <Link href="/professionisti" className="hover:text-bob-indigo">
          Professionisti
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-bob-ink/70">{p.fullName}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Colonna principale */}
        <div className="flex flex-col gap-6">
          {/* Intestazione */}
          <header className="card p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-bob-indigo-100 text-xl font-bold text-bob-indigo">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-bob-ink sm:text-2xl">
                  {p.fullName}
                </h1>
                {p.headline && (
                  <p className="mt-0.5 text-sm text-bob-ink/65">{p.headline}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
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

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-black/5 pt-4">
              <Stars value={p.avgRating} count={p.nRatings} size="md" />
              <VerificationLevelBadge
                level={p.verificationLevel}
                verifiedAt={p.verifiedAt}
              />
              {p.yearsExperience !== null && (
                <span className="text-sm text-bob-ink/60">
                  {p.yearsExperience} anni di esperienza
                </span>
              )}
              {p.responseTimeLabel && (
                <span className="text-sm text-bob-ink/60">
                  {p.responseTimeLabel}
                </span>
              )}
            </div>

            {/* Data del riscontro dichiarata per esteso (10.4, versione
                provvisoria). Il badge la mostra già in forma breve, ma qui
                serve dire a chiare lettere che il controllo vale per QUELLA
                data: finché non esiste il ricontrollo periodico, è l'unica
                cosa onesta da scrivere accanto a un'etichetta che non scade. */}
            {p.verificationLevel !== "none" && p.verifiedAt && (
              <p className="mt-3 text-xs text-bob-ink/45">
                Verifica effettuata il {fmtDate(p.verifiedAt)}. Il riscontro si
                riferisce a quella data e non è una garanzia di BOB sul lavoro
                svolto.
              </p>
            )}
          </header>

          {/* Bio */}
          {p.bio && (
            <section className="card p-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
                Chi è
              </h2>
              <p className="text-sm leading-relaxed text-bob-ink/75">{p.bio}</p>
            </section>
          )}

          {/* Portfolio lavori conclusi (foto caricate dai piani Pro/Business) */}
          {portfolio.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
                Lavori realizzati ({portfolio.length})
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
                      {item.description && (
                        <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-bob-ink/60">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recensioni */}
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
              Recensioni {reviews.length > 0 && `(${reviews.length})`}
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-bob-ink/55">
                Ancora nessuna recensione. Sii il primo a lavorare con{" "}
                {p.fullName}.
              </p>
            ) : (
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
            )}
          </section>
        </div>

        {/* Colonna laterale: prezzo + contatto (sticky su desktop) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <InstantBookingEntry
            professionalId={p.id}
            professionalName={p.fullName}
          />
          <div className="card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-bob-ink/50">
              Costo indicativo
            </p>
            <div className="mt-1.5 text-2xl">
              <PriceTag min={p.minPrice} max={p.maxPrice} />
            </div>
            {p.priceNote && (
              <p className="mt-1 text-xs text-bob-ink/55">{p.priceNote}</p>
            )}

            <div className="mt-5">
              <ContactButton
                professional={p}
                className="btn-primary w-full py-3"
                label={`Contatta ${p.fullName.split(" ")[0]}`}
              />
            </div>
            <p className="mt-3 text-center text-xs text-bob-ink/45">
              Usare Bob è gratis. La fee si applica solo a lavoro concluso.
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
            label={`Contatta ${p.fullName.split(" ")[0]}`}
          />
        </div>
      </div>
    </div>
  );
}
