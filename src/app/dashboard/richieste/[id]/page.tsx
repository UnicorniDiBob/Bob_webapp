"use client";

// /dashboard/richieste/<id>: LA PAGINA DI UNA RICHIESTA DEL CLIENTE (15/10).
//
// Privata due volte: il middleware (ROTTE_PRIVATE) manda al login chi non ha
// una sessione prima che la pagina parta, e la query in RichiestaCliente
// legge solo le richieste di chi e' collegato. Lo staff va al pannello admin
// come da /dashboard; un pro resta qui e trova «non c'e' o non e' tua».

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { RichiestaCliente } from "@/components/RichiestaCliente";

export default function RichiestaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Gli account staff non hanno un'area personale: dritti al pannello admin.
  useEffect(() => {
    if (!loading && (role === "admin" || role === "cs")) {
      router.replace("/admin");
    }
  }, [loading, role, router]);

  if (loading || !user || role === "admin" || role === "cs") {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/65" aria-busy="true">
        Carico la tua area personale…
      </div>
    );
  }

  return (
    <div className="container-bob py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <RichiestaCliente id={id} />
      </div>
    </div>
  );
}
