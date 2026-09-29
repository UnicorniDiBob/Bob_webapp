import { cookies } from "next/headers";
import { creaClientServer } from "./fabbrica";

// Client Supabase lato server (Server Components, route handlers).
// Usato per SSR del catalogo e per leggere la sessione utente.
//
// E' IL PUNTO UNICO che dice chi sta guardando: vedi ./fabbrica.ts e il test
// ./punto-unico.test.ts. Una route che deve sapere chi chiama usa questa
// funzione e basta — mai i cookie letti a mano, mai un token preso altrove.
export function createClient() {
  const cookieStore = cookies();

  return creaClientServer(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll chiamato da un Server Component: ignorato.
          // Il refresh della sessione è gestito dal middleware.
        }
      },
    }
  );
}
