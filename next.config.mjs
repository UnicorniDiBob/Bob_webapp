/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Rinomina categorie (migration 013): preserva SEO e link esterni.
    return [
      {
        source: "/servizi/dj",
        destination: "/servizi/musica-intrattenimento",
        permanent: true,
      },
      {
        source: "/servizi/supporto-excel",
        destination: "/servizi/supporto-informatico",
        permanent: true,
      },
      // AREA PERSONALE — due riorganizzazioni in un giorno, quindi due strati.
      //
      // Il 19/08 mattina: la pagina unica del profilo e quella dell'account
      // sono diventate sezioni separate sotto /dashboard.
      // Il 19/08 pomeriggio: lavoro e configurazione sono stati separati per
      // davvero — /dashboard resta il lavoro, /impostazioni la configurazione.
      // Servono tutti e tre i salti, e L'ORDINE CONTA: in Next vince la prima
      // regola che combacia, quindi i due casi speciali stanno prima del
      // carattere jolly, altrimenti /dashboard/profilo finirebbe su
      // /impostazioni/profilo, che non esiste.
      //
      // QUI E NON CON redirect() IN UNA PAGINA: provato, e in una pagina
      // prerenderizzata staticamente Next non emette un redirect HTTP. Serve un
      // guscio con id="__next_error__" e la destinazione dentro il payload RSC,
      // che il browser segue via JavaScript: funziona per una persona, costa un
      // boot completo, e per un crawler o un curl sembra una pagina di errore.
      // Da qui invece esce un 307 vero con l'header Location, prima del routing.
      //
      // permanent: false di proposito. Un 308 viene messo in cache dal browser
      // in modo aggressivo e non si disfa: dopo due cambi di struttura nello
      // stesso giorno, l'ultima cosa che serve e' un redirect che non si
      // riesce piu' a togliere dalla cache di chi e' passato.
      {
        source: "/dashboard/profilo",
        destination: "/impostazioni/azienda",
        permanent: false,
      },
      {
        source: "/dashboard/account",
        destination: "/impostazioni/dati",
        permanent: false,
      },
      // `+` e non `*`: con l'asterisco il jolly combacia anche con ZERO
      // segmenti, quindi /dashboard NUDO finiva su /impostazioni e l'area di
      // lavoro diventava irraggiungibile. Trovato con la prova sulle rotte,
      // non leggendo il file: il redirect era corretto per tutte le sezioni e
      // sbagliato solo per il percorso che conta di piu'.
      {
        source: "/dashboard/:sezione+",
        destination: "/impostazioni/:sezione+",
        permanent: false,
      },
      // /impostazioni da sola non e' una pagina: porta alla prima sezione, che
      // e' la stessa per entrambi i ruoli.
      {
        source: "/impostazioni",
        destination: "/impostazioni/dati",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
