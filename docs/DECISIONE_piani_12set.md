# I piani, come sono decisi l'11/09 (scritto il 12/09)

Fonte: foglio scritto a mano di Lucio dell'11/09, letto insieme il 12/09.
Questa pagina dice l'INTENTO. Lo stato del prodotto lo dice il codice: la
matrice che vale davvero e' `src/lib/piani.ts`, e le pagine la disegnano.

## Cosa cambia

1. **Il piano "Bob Pro" si chiama "Bob Plus".** Cambia l'etichetta, non l'id:
   nel database resta `pro`, valore dell'enum `subscription_tier`. Rinominare
   l'enum e' una migrazione a se' stante, da decidere a parte.
   Effetto buono: "Pro" e "Pro+" restano liberi per i LIVELLI DI VERIFICA
   (`src/lib/vat.ts`), che non sono piani e oggi si chiamano uguale.
2. **Il listino e' una tabella, non tre elenchi.** Ogni funzione e' una riga e
   dice, per ciascun piano, se c'e', se non c'e' o se e' **in arrivo**. Il
   terzo stato esiste perche' meta' del listino non e' ancora costruita, e
   segnarla con una spunta sarebbe una promessa che non manteniamo (23.1).
3. **La fee dell'8% e' uguale sui tre piani.** Non e' una leva del piano. Resta
   legata alla Garanzia Bob, che attiva il professionista.
4. **Analisi base e Analisi avanzate** (nomi confermati da Lucio): da dove
   arriva il lavoro e da dove arrivano i ricavi. Segnate "in arrivo" su tutti i
   piani dove previste; si implementano dopo.

## La matrice

| | Free | Bob Plus | Bob Business |
|---|---|---|---|
| Profilo pubblico con le tariffe | si | si | si |
| Messaggi con i clienti | si | si | si |
| Richieste ricevute | senza tetto | senza tetto | senza tetto |
| Verifica P.IVA e badge | no | si | si |
| Verifica con documenti (Pro+) | no | si | si |
| Risalto nei risultati | no | si | si |
| Recensioni sul profilo | no | si | si |
| Foto portfolio | no | 1 | illimitate |
| Calendario e appuntamenti | no | si | si |
| Preventivi digitali | no | si | si |
| Prenotazione diretta | no | si | si |
| Chiamata al cliente in app | no | in arrivo | in arrivo |
| Assistente che risponde ai messaggi | no | in arrivo | in arrivo |
| Analisi base | in arrivo | in arrivo | in arrivo |
| Analisi avanzate | no | in arrivo | in arrivo |
| Fatturazione elettronica | no | no | in arrivo |
| Pagamenti su BOB | no | no | in arrivo |
| Supporto prioritario | no | no | in arrivo |
| Costo per contatto | nessuno | nessuno | nessuno |
| Fee sul lavoro concluso | 8% | 8% | 8% |

## Quello che la tabella promette e il codice non fa ancora

Non sono bug del listino: sono il lavoro che ne discende.

- **Calendario e appuntamenti**: la tabella li toglie al Free, il prodotto oggi
  li da' a tutti. Finche' non c'e' il gate, la pagina dice una cosa e l'app ne
  fa un'altra. E' la voce piu' urgente.
- **Recensioni** e **risalto nei risultati** vanno legati al piano allo stesso
  modo.
- Le voci **in arrivo** non hanno codice: chiamata in app, assistente di
  risposta, analisi, fatturazione, pagamenti, supporto prioritario.

## Restato aperto (12/09)

- L'8% vale solo sui lavori con Garanzia Bob, o su ogni lavoro concluso? Qui e'
  scritto come oggi: solo con la Garanzia.
- L'assistente che risponde ai messaggi sta in Bob Plus o solo in Business?
  Qui e' in entrambi.
- **Durata della verifica**: NON e' mai stata decisa. Il repo ha solo una
  proposta a 6 mesi (10.4, `docs/legal/VERIFICA_PIVA_come_farla.md` §6) e il
  database non ha nessuna scadenza: oggi una verifica vale per sempre. Il
  ricontrollo puo' essere automatico (VIES); il declassamento no, mai (art. 22
  GDPR, regola gia' scritta).
- **SLA della coda di verifica**: da scrivere in quattro numeri — entro quando
  rispondiamo, in che orari, cosa vede il pro mentre aspetta, cosa succede se
  sforiamo. Serve anche ai ToS pro ("SLA di esame") e all'uscita "parla con una
  persona" della chat.
