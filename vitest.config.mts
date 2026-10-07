import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Solo unit test su funzioni pure di src/lib — niente DOM, niente Next.js
// runtime. Se una fase futura ha bisogno di testare componenti React, questa
// config va estesa con l'ambiente jsdom, non riscritta da capo.
//
// L'alias @/ (07/10) e' quello di tsconfig: senza, un test non puo' importare
// un modulo che a sua volta importa con @/ (notifiche.ts, un componente
// disegnato con renderToStaticMarkup, che non ha bisogno del DOM). Il JSX
// lo trasforma oxc (Vite 8): tsconfig dice «preserve», perche' a farlo e' Next.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
