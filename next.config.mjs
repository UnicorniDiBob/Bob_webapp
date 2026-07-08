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
    ];
  },
};

export default nextConfig;
