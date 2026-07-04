import { createServerClient } from "@supabase/ssr";

// Client Supabase senza cookie, per contesti senza richiesta HTTP
// (sitemap, generateStaticParams). Legge solo il catalogo pubblico via RLS anon.
export function createStaticClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Nessun contesto di richiesta: no-op.
        },
      },
    }
  );
}
