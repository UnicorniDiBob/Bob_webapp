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
      // Area personale divisa in sezioni (19/08/2026). I due vecchi indirizzi
      // restano perche' sono nei segnalibri, nei deep link del banner di
      // verifica e nelle email gia' inviate dal pannello admin.
      //
      // QUI E NON CON redirect() IN UNA PAGINA: provato prima, e in una pagina
      // prerenderizzata staticamente Next non emette un redirect HTTP. Serve un
      // guscio con id="__next_error__" e la destinazione dentro il payload RSC,
      // che il browser segue via JavaScript: funziona per una persona, costa un
      // boot completo, e per un crawler o un curl sembra una pagina di errore.
      // Da qui invece esce un 308 vero con l'header Location, prima del routing.
      //
      // permanent: false di proposito. Un 308 viene messo in cache dal browser
      // in modo aggressivo e non si disfa: se domani decidiamo che /dashboard/
      // profilo deve tornare a essere una pagina, chi l'ha visitata una volta
      // continuerebbe a essere rimbalzato. Un 307 lascia la porta aperta.
      {
        source: "/dashboard/profilo",
        destination: "/dashboard/azienda",
        permanent: false,
      },
      {
        source: "/dashboard/account",
        destination: "/dashboard/dati",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
