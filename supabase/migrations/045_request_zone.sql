-- 045: la zona della richiesta — l'informazione grossolana che il
--      professionista PUÒ vedere prima di essere scelto.
--
-- PERCHÉ
-- La 044 ha tolto via e civico dalla vista del professionista finché non c'è un
-- appuntamento confermato. Giusto, ma da sola lascia il pro con la sola città:
-- "Milano" non dice se il lavoro è a dieci minuti o dall'altra parte della
-- tangenziale, e un pro che non sa dove andrà o non preventiva o preventiva
-- male. La divulgazione progressiva non è "niente, poi tutto": è "abbastanza
-- per decidere, poi quello che serve per lavorare".
--
-- PERCHÉ UNA ZONA E NON UN PUNTO SFUOCATO
-- Sfuocare un indirizzo richiede prima di trasformarlo in coordinate, e
-- trasformarlo richiede un fornitore di geocoding: quel fornitore riceverebbe
-- gli indirizzi dei clienti e diventerebbe un responsabile del trattamento, con
-- DPA art. 28 e regione UE (roadmap 40.0, ancora parcheggiata). C'è anche una
-- trappola tecnica: un cerchio disegnato attorno al punto vero ha il punto vero
-- come centro, quindi il browser del pro riceverebbe comunque la posizione
-- esatta e il raggio sarebbe un disegno, non una tutela.
-- La zona evita entrambe le cose perché non deriva dall'indirizzo: la sceglie
-- il cliente. Quello che conserviamo è "isola", non un punto ricavato da casa
-- sua. Nessun fornitore, nessuna conversione, e il livello di dettaglio è
-- deciso dall'interessato invece che da noi.
--
-- PERCHÉ QUI E NON IN request_addresses
-- request_addresses è leggibile solo dopo l'accettazione: è il suo scopo. La
-- zona deve essere visibile PRIMA, a tutti i professionisti invitati, quindi
-- vive sulla richiesta e segue le policy già esistenti di requests. Le due cose
-- hanno destinatari diversi, quindi stanno in due posti diversi.
--
-- CONFORMITÀ
-- Base giuridica: art. 6(1)(b) esecuzione del contratto — il pro deve poter
--   valutare la trasferta per formulare un preventivo.
-- Finalità: la stessa già dichiarata (gestione delle richieste). Nessuna nuova.
-- Minimizzazione: uno slug da un elenco chiuso di quartieri, scelto dal
--   cliente. Nessuna coordinata del cliente, nessun geocoding, nessun
--   fornitore. Facoltativo: la richiesta funziona anche senza.
-- Conservazione: colonna della richiesta, vive e muore con essa.
-- DPIA: nessun trigger di §7.3.
--
-- Idempotente.

alter table public.requests
  add column if not exists zone_slug text;

comment on column public.requests.zone_slug is
  'Quartiere scelto dal cliente da un elenco chiuso (src/lib/zones.ts). Volutamente grossolano: e l''informazione di posizione che i professionisti invitati possono vedere prima dell''accettazione. Non e ricavato dall''indirizzo — lo sceglie il cliente. Via e civico stanno in request_addresses (mig 044) e restano chiusi fino all''appuntamento confermato.';

create index if not exists requests_zone_slug_idx
  on public.requests (zone_slug)
  where zone_slug is not null;
