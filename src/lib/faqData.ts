// Dati FAQ — modulo lato server condiviso (niente "use client" qui).

export interface FaqItem {
  q: string;
  a: string;
}

export const HOME_FAQ: FaqItem[] = [
  {
    q: "Quanto costa usare Bob?",
    a: "Per te che cerchi un servizio, usare Bob è gratis. Non vendiamo lead ai professionisti: la fee si applica solo quando un lavoro si chiude davvero, così gli incentivi sono allineati al risultato.",
  },
  {
    q: "Perché vedo i prezzi solo entrando nel profilo?",
    a: "Bob usa la tariffa per filtrare e ordinare i professionisti, ma il dettaglio del costo lo trovi nella scheda di ciascun professionista. Così la lista resta pulita e tu vedi subito chi fa al caso tuo.",
  },
  {
    q: "Bob sceglie il professionista al posto mio?",
    a: "No. Bob raccoglie il contesto, filtra i profili più rilevanti e ti aiuta a scrivere il primo messaggio. La scelta resta sempre tua: puoi contattare uno o più professionisti.",
  },
  {
    q: "In quali città è attivo Bob?",
    a: "Bob è operativo a Milano. Roma e Torino stanno aprendo: lascia la tua email sulla pagina della città e ti avvisiamo appena siamo attivi.",
  },
  {
    q: "Cosa significa professionista verificato?",
    a: "Mostriamo solo segnali di fiducia che corrispondono a un processo reale. Un professionista verificato ha superato i nostri controlli di base; gli altri sono indicati come in verifica o non ancora verificati, senza promesse eccessive.",
  },
];
