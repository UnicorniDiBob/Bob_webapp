import { defineConfig } from "vitest/config";

// Solo unit test su funzioni pure di src/lib — niente DOM, niente Next.js
// runtime. Se una fase futura ha bisogno di testare componenti React, questa
// config va estesa con l'ambiente jsdom, non riscritta da capo.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
