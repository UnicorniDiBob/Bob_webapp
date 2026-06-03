import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { UnreadProvider } from "@/components/UnreadProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bob-webapp-six.vercel.app";

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
        <AuthProvider>
          <UnreadProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </UnreadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
