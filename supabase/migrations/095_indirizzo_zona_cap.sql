-- 095_indirizzo_zona_cap.sql
--
-- Zona e CAP autodichiarati sull'indirizzo salvato (customer_addresses,
-- migrazione 020), chiesti UNA VOLTA quando il cliente lo salva in
-- /impostazioni/indirizzi — non ricavati dall'indirizzo.
--
-- PERCHÉ. La 045/046 hanno già risolto questo problema per la singola
-- richiesta: il cliente sceglie un quartiere da un elenco chiuso o digita
-- un CAP, mai geocoding (fornitore esterno = DPA art. 28, roadmap 40.0,
-- ancora parcheggiata — vedi commento della 045). Lo stesso principio vale
-- qui: quando il cliente sceglie un indirizzo salvato in chat, Bob non deve
-- richiedere la zona se l'indirizzo la porta già con sé. Stessa
-- minimizzazione, stessa base giuridica, nessuna conversione fra i due
-- campi — restano paralleli, esattamente come su requests.
--
-- PERCHÉ NON DERIVARLI DALL'ADDRESS_LINE. address_line è testo libero
-- ("Via Solferino 28"): tradurlo in zona o CAP richiede geocoding, la
-- stessa cosa che la 045 esclude esplicitamente. Il cliente li dichiara,
-- non li ricaviamo noi.
--
-- CONFORMITÀ
-- Base giuridica, finalità, minimizzazione: le stesse della 045/046,
-- applicate all'indirizzo invece che alla singola richiesta. Facoltativi
-- entrambi: un indirizzo salvato senza zona né CAP continua a funzionare
-- esattamente come oggi (Bob chiede la zona in chat, come sempre).
-- Conservazione: vive e muore con la riga di customer_addresses.
-- DPIA: nessun trigger di §7.3.
--
-- Idempotente.

alter table public.customer_addresses
  add column if not exists zone_slug text,
  add column if not exists postal_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_addresses_postal_code_format'
  ) then
    alter table public.customer_addresses
      add constraint customer_addresses_postal_code_format
      check (postal_code is null or postal_code ~ '^[0-9]{5}$');
  end if;
end $$;

comment on column public.customer_addresses.zone_slug is
  'Quartiere dichiarato dal cliente da un elenco chiuso (src/lib/zones.ts), chiesto una volta al salvataggio dell''indirizzo. Non ricavato dall''indirizzo — vedi 045. Se presente, Bob salta la domanda "in che zona?" quando il cliente sceglie questo indirizzo salvato in chat.';

comment on column public.customer_addresses.postal_code is
  'CAP dichiarato dal cliente, ripiego quando non riconosce un quartiere (vedi 046). Non ricavato dall''indirizzo. Cinque cifre.';
