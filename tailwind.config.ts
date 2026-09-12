import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bob: {
          indigo: "#3730a3",
          "indigo-600": "#4338ca",
          "indigo-50": "#eef2ff",
          "indigo-100": "#e0e7ff",
          yellow: "#fbbf24",
          ink: "#1e1b4b",
        },
      },
      fontFamily: {
        // Schibsted Grotesk, caricato da next/font in src/app/layout.tsx.
        // Quello che segue e' la scorta per i pochi millisecondi prima che il
        // file sia pronto, e per il caso in cui non arrivi affatto.
        sans: [
          "var(--font-schibsted)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,27,75,0.04), 0 8px 24px rgba(30,27,75,0.06)",
        "card-hover": "0 2px 4px rgba(30,27,75,0.06), 0 16px 40px rgba(30,27,75,0.12)",
      },
      maxWidth: {
        // Le pagine pubbliche. 1280 e non 1120: il testo di queste pagine non
        // usa mai la larghezza del contenitore — si limita da solo (l'eroe a
        // max-w-lg, i sottotitoli a max-w-xl, le pagine legali a max-w-3xl).
        // Quello che sta nel contenitore sono griglie di schede, e quelle lo
        // spazio lo usano. L'argomento "le righe lunghe si leggono peggio"
        // qui non si applica, perche' le righe non si allungano.
        container: "1280px",
        // Le pagine applicazione. Fluido fino a qui: su un portatile da 1512px
        // usa tutto, su un monitor grande si ferma prima che le righe della
        // chat e delle tabelle diventino illeggibili.
        app: "1600px",
      },
      // La scala tipografica.
      //
      // Non e' un ritocco estetico: l'87% delle utility di dimensione del
      // progetto (820 su 942) erano text-sm o text-xs, cioe' 14px o meno, e
      // la dimensione piu' frequente sullo schermo era 12px. Alzare qui i
      // token vale piu' di 500 sostituzioni sparse nei componenti, si rivede
      // in un file solo e si annulla in una riga.
      //
      // I valori grandi (2xl in su) restano quelli di Tailwind: il problema
      // non erano i titoli.
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }], //  11px - solo dati fitti (calendario)
        xs: ["0.8125rem", { lineHeight: "1.125rem" }],    //  13px - era 12
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],    //  15px - era 14
        base: ["1.0625rem", { lineHeight: "1.625rem" }],  //  17px - era 16
        lg: ["1.1875rem", { lineHeight: "1.75rem" }],     //  19px - era 18
        xl: ["1.3125rem", { lineHeight: "1.875rem" }],    //  21px - era 20
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease both",
        "fade-in": "fade-in 0.3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
