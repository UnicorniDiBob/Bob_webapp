-- 046: il CAP come ripiego quando il cliente non riconosce nessun quartiere.
--
-- PERCHÉ
-- La 045 ha dato al professionista la zona al posto di via e civico. Funziona
-- finché il cliente sa dire in che quartiere sta — e non è scontato: chi si è
-- appena trasferito, chi chiede l'intervento per la casa di un genitore, chi
-- semplicemente non usa quei nomi. Se l'unico ripiego è "Milano e basta", il
-- professionista torna a non sapere niente e la 045 serve a metà.
-- Il CAP lo sanno tutti, sta sulle bollette, e a Milano copre più o meno la
-- stessa estensione di un quartiere: come grana è equivalente alla zona, quindi
-- non peggiora la minimizzazione, la rende solo raggiungibile per più persone.
--
-- PERCHÉ NON AL POSTO DELLA ZONA
-- La zona resta la prima scelta perché è un nome che un professionista legge
-- senza pensarci ("Isola" dice tutto), mentre un CAP va tradotto a mente. Il
-- CAP è il secondo tentativo, non il primo.
--
-- CONFORMITÀ
-- Base giuridica: art. 6(1)(b), come la 045 — valutare la trasferta per
--   preventivare.
-- Finalità: la stessa già dichiarata. Nessuna nuova.
-- Minimizzazione: cinque cifre scelte dal cliente, grana equivalente al
--   quartiere. Non ricavato dall'indirizzo: lo digita lui. Facoltativo.
-- Conservazione: colonna della richiesta, vive e muore con essa.
-- DPIA: nessun trigger di §7.3.
--
-- NOTA SULLA DISTANZA
-- Il CAP non porta con sé un punto: per la distanza in chilometri servirebbe un
-- elenco di centroidi per CAP, che oggi non abbiamo (vedi attività 41.5). Nel
-- frattempo il professionista legge "Milano 20159" senza il "~4 km da te", che
-- è esattamente quanto sappiamo — meglio di un numero inventato.
--
-- Idempotente.

alter table public.requests
  add column if not exists postal_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'requests_postal_code_format'
  ) then
    alter table public.requests
      add constraint requests_postal_code_format
      check (postal_code is null or postal_code ~ '^[0-9]{5}$');
  end if;
end $$;

comment on column public.requests.postal_code is
  'CAP digitato dal cliente quando non riconosce nessun quartiere dell''elenco (mig 045). Cinque cifre, grana equivalente a un quartiere. Non ricavato dall''indirizzo. Via e civico restano in request_addresses (mig 044), chiusi fino all''appuntamento confermato.';
