import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { UnreadProvider } from "@/components/UnreadProvider";
import { Header } from "@/components/Header";
import { CancellazioneBanner } from "@/components/CancellazioneBanner";
import { Footer } from "@/components/Footer";
import { MessagesBubble } from "@/components/MessagesBubble";
import { ProBanner } from "@/components/ProBanner";
import { JsonLd } from "@/components/JsonLd";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.meetonda.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BOB — Trova il professionista giusto, con prezzi chiari",
    template: "%s · BOB",
  },
  description:
    "Raccontami il problema e ti aiuto a capire chi contattare, con più chiarezza su prezzo, disponibilità e qualità. Idraulici, elettricisti, pulizie e altri servizi a Milano.",
  keywords: [
    "idraulico Milano",
    "elettricista Milano",
    "pulizie Milano",
    "marketplace servizi locali",
    "professionisti verificati",
  ],
  openGraph: {
    title: "BOB — Trova il professionista giusto, con prezzi chiari",
    description:
      "Bob è il concierge che ti aiuta a capire il problema e ti porta ai professionisti più adatti.",
    url: siteUrl,
    siteName: "BOB",
    locale: "it_IT",
    type: "website",
    // Immagine per le anteprime link (WhatsApp, iMessage, social).
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "BOB — il concierge dei servizi locali",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BOB — Trova il professionista giusto, con prezzi chiari",
    description:
      "Bob è il concierge che ti aiuta a capire il problema e ti porta ai professionisti più adatti.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="flex min-h-screen flex-col">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "BOB",
            url: siteUrl,
            description:
              "Concierge digitale per i servizi locali: idraulici, elettricisti, pulizie e altri professionisti verificati, con prezzi chiari.",
            areaServed: { "@type": "Country", name: "Italia" },
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "BOB",
            url: siteUrl,
            inLanguage: "it-IT",
          }}
        />
        <AuthProvider>
          <UnreadProvider>
            <Header />
            <CancellazioneBanner />
            <main className="flex-1">{children}</main>
            <ProBanner />
            <MessagesBubble />
            <Footer />
          </UnreadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
