import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-bob flex min-h-[calc(100vh-8rem)] items-center justify-center py-16">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-bob-indigo-50 text-bob-indigo">
          <Compass className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-bold uppercase tracking-wide text-bob-indigo">
          Errore 404
        </p>
        <h1 className="mt-1 text-2xl font-bold text-bob-ink sm:text-3xl">
          Questa pagina non esiste
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-bob-ink/60">
          Forse il link è cambiato. Torna alla home e lascia che Bob ti aiuti a
          trovare quello che cerchi.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href="/" className="btn-primary px-6 py-3" data-testid="link-home-404">
            Torna alla home
          </Link>
          <Link
            href="/professionisti"
            className="btn-secondary px-6 py-3"
          >
            Sfoglia i professionisti
          </Link>
        </div>
      </div>
    </div>
  );
}
