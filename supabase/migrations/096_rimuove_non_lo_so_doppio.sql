-- 096_rimuove_non_lo_so_doppio.sql
--
-- RINUMERATA DA 094 A 096 PRIMA DEL MERGE (24 settembre). Il numero 094
-- era già preso da `094_tetto_esame_cessazione.sql`, su `main` dal 20
-- settembre: l'ho scelto guardando un `ls` di un clone locale indietro di
-- sei commit, senza `git fetch` — esattamente la trappola scritta
-- nell'handoff ("un numero di migrazione si prende dalla storia applicata
-- E dai rami spinti").
--
-- ATTENZIONE, STORICO DISALLINEATO: in produzione questa migrazione è
-- stata applicata il 22 settembre col numero vecchio, quindi lo storico di
-- Supabase la elenca come `094_rimuove_non_lo_so_doppio`. È solo
-- l'etichetta a non coincidere — l'effetto sui dati è applicato e
-- verificato (zero opzioni "non lo so" duplicate sul catalogo). Essendo
-- idempotente, rieseguirla con questo numero è un no-op che riallinea lo
-- storico: farlo o lasciare questa nota è indifferente per i dati.
--
-- La scheda lavoro (SchedaLavoro.tsx, FieldRow) aggiunge gia' da sola un
-- chip "Non lo so" per ogni campo select con unknown_ok=true. La 092 aveva
-- seminato "non lo so" anche come membro letterale dell'array options in
-- 11 chiavi diverse (14 righe, contando i sotto-servizi ripetuti) — il
-- risultato e' un chip duplicato, "non lo so" minuscolo affianco a "Non lo
-- so" maiuscolo, sullo stesso campo.
--
-- Verificato in produzione prima di scrivere il file (22 settembre): la
-- lista completa, per sotto-servizio/chiave, e' più ampia di quella
-- segnalata a mano - fixture, purpose (x2), ceiling_height (x2) e
-- fixture_type non erano stati notati. Per questo la correzione qui sotto
-- non elenca le righe: toglie "non lo so" da OGNI campo select con
-- unknown_ok=true in tutto il catalogo, qualunque sotto-servizio lo porti
-- oggi o in futuro — lo stesso errore di seeding non deve poter tornare
-- silenzioso una settima volta.
--
-- Fix nel seed, non nel componente: il componente ha gia' la logica giusta
-- (un solo chip "Non lo so" per unknown_ok), e' il dato a portarne un
-- secondo.
--
-- Idempotente: filtra l'opzione "non lo so" fuori dall'array ogni volta
-- che gira, senza effetto se e' gia' assente.

begin;

update public.subservices
   set quote_fields = coalesce(
     (
       select jsonb_agg(
         case
           when (elem->>'type') = 'select'
            and coalesce((elem->>'unknown_ok')::boolean, false)
            and elem ? 'options'
           then elem || jsonb_build_object(
                  'options',
                  (select coalesce(jsonb_agg(opt), '[]'::jsonb)
                     from jsonb_array_elements_text(elem->'options') opt
                    where opt <> 'non lo so')
                )
           else elem
         end
       )
       from jsonb_array_elements(quote_fields) elem
     ),
     '[]'::jsonb
   )
 where quote_fields <> '[]'::jsonb;

commit;
