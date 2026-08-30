-- ---------------------------------------------------------------------------
-- 065 — il nome dell'attività, e non quello del titolare
-- ---------------------------------------------------------------------------
--
-- IL PROBLEMA. La scheda pubblica di un professionista si intitolava con
-- profiles.full_name, cioè con il nome e il cognome della persona che si è
-- iscritta. Per i sei profili seminati a giugno non si vedeva, perché il seed
-- ci aveva messo dentro delle ragioni sociali («IdroMilano Express»); alla
-- prima iscrizione vera, il 30/08, è comparso quello che il codice fa davvero:
-- «lucio mozzaglia» come titolo della scheda, e la ditta relegata a
-- sottotitolo. Segnalato da Lucio lo stesso giorno.
--
-- Sono due dati diversi con due usi diversi:
--   - il NOME DELL'ATTIVITÀ è ciò con cui il professionista si presenta ai
--     clienti. È pubblico perché è il suo scopo;
--   - il NOME DEL TITOLARE serve a NOI — assistenza, verifica della partita
--     IVA, fatturazione, obblighi di legge — e resta dentro, come tutti gli
--     altri dati anagrafici (profiles / profile_private).
--
-- Tenerli separati non è estetica: finché sono la stessa colonna, ogni pagina
-- pubblica pubblica un dato personale, e non c'è modo di smettere senza
-- cancellare anche il nome con cui il pro si fa trovare.
--
-- PRIVACY (DATA_COMPLIANCE §2). Nessuna finalità nuova: è il profilo pubblico
-- del professionista, base giuridica contratto, retention vita dell'account,
-- cancellazione a cascata con professionals. Non è un dato personale nuovo —
-- semmai ne toglie uno dalla vista pubblica. Riga di RoPA aggiornata (punto
-- «Profilo pubblico del professionista»), nessun nuovo trattamento.
--
-- COMPATIBILITÀ. Colonna nullable e backfill dal nome già mostrato: nessuna
-- scheda cambia contenuto al momento dell'applicazione. Da qui in poi la
-- riempie l'iscrizione, che la chiede obbligatoria e la propone precompilata.
--
-- Idempotente: add column if not exists, drop-then-create del vincolo, backfill
-- che tocca solo le righe ancora vuote.
-- ---------------------------------------------------------------------------

alter table public.professionals
  add column if not exists business_name text;

comment on column public.professionals.business_name is
  'Nome dell''attività: è QUESTO che compare sulla scheda pubblica e negli elenchi. '
  'Il nome del titolare (profiles.full_name) resta un dato interno. '
  'Nullable per compatibilità: quando è vuoto la UI ricade sul nome della persona. '
  'Vedi migrazione 065.';

-- Un nome vuoto o di un carattere non è un nome: meglio NULL (e il fallback)
-- che una scheda intitolata «.».
alter table public.professionals
  drop constraint if exists professionals_business_name_len;
alter table public.professionals
  add constraint professionals_business_name_len
  check (business_name is null or char_length(btrim(business_name)) between 2 and 80);

-- Backfill: i profili che esistono già continuano a mostrare esattamente
-- quello che mostravano prima di questa migrazione.
update public.professionals p
   set business_name = btrim(pr.full_name)
  from public.profiles pr
 where pr.user_id = p.user_id
   and p.business_name is null
   and pr.full_name is not null
   and char_length(btrim(pr.full_name)) between 2 and 80;
