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
        sans: [
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
        container: "1120px",
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
