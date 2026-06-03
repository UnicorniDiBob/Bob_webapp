import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase lato server (Server Components, route handlers).
// Usato per SSR del catalogo e per leggere la sessione utente.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll chiamato da un Server Component: ignorato.
            // Il refresh della sessione è gestito dal middleware.
          }
        },
      },
    }
  );
}
