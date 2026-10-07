"use client";

// IL COLLEGAMENTO CHE APRE UNA CHAT, CON L'APERTURA ANIMATA (07/10).
//
// Un <Link> come gli altri — prefetch, clic col tasto centrale, «apri in una
// nuova scheda» restano quelli del browser — che al clic semplice fa
// crescere la chat dal punto del tocco (lib/aperturaChat.ts). Si usa sui
// tasti che portano a una conversazione: dal calendario, dall'area
// personale, dai riquadri delle richieste.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apriChatDa, puntoDelTocco } from "@/lib/aperturaChat";

export function LinkChat({
  href,
  className,
  children,
  ...resto
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        // Ctrl/Cmd/Maiusc/tasto centrale: e' il browser a decidere.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
          return;
        }
        e.preventDefault();
        apriChatDa(puntoDelTocco(e), () => router.push(href));
      }}
      {...resto}
    >
      {children}
    </Link>
  );
}
