-- 058: chiude i tre rilievi che la 057 ha aperto sugli advisor, e sposta i
-- gettoni della città in una colonna invece di una funzione esposta.
--
-- COSA È SUCCESSO. Applicata la 057, gli advisor di sicurezza hanno segnalato
-- tre funzioni SECURITY DEFINER chiamabili via /rest/v1/rpc:
--   - sync_coverage_zones() e publish_coverage_keys(): sono funzioni di
--     TRIGGER, non devono essere chiamabili da nessuno. Stesso rilievo, stessa
--     cura della 034b: si revoca l'execute.
--   - request_coverage_keys(): l'avevo esposta di proposito, perché il client
--     deve sapere quali gettoni ha una richiesta per fare il match. Ma per
--     leggere private.slugify doveva essere SECURITY DEFINER, e una funzione
--     SECURITY DEFINER aperta a anon è esattamente ciò che la regola di
--     progetto vieta.
--
-- LA CURA, migliore dell'originale. I gettoni di una città non cambiano mai
-- (Milano è a Milano, in Lombardia, nel nord): non serve calcolarli a ogni
-- richiesta. Si materializzano su cities.coverage_keys, che è già in lettura
-- pubblica, mantenuti da un trigger. Il client compone il gettone di zona come
-- 'zone:' || citta.slug || '/' || zona, che è concatenazione di stringhe che
-- vengono dal database: nessuna funzione da esporre, nessuno slugify
-- duplicato in TypeScript, nessun rischio che le due stringhe divergano.
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. Le funzioni di trigger non sono API
-- ---------------------------------------------------------------------------

revoke all on function public.sync_coverage_zones() from public;
revoke all on function public.sync_coverage_zones() from anon;
revoke all on function public.sync_coverage_zones() from authenticated;

revoke all on function public.publish_coverage_keys() from public;
revoke all on function public.publish_coverage_keys() from anon;
revoke all on function public.publish_coverage_keys() from authenticated;

-- La 057 aveva ridefinito questa: stesso trattamento, per non lasciarla aperta.
revoke all on function public.protect_professional_columns() from public;
revoke all on function public.protect_professional_columns() from anon;
revoke all on function public.protect_professional_columns() from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Niente più funzione esposta per i gettoni della richiesta
-- ---------------------------------------------------------------------------

drop function if exists public.request_coverage_keys(uuid, text);

-- ---------------------------------------------------------------------------
-- 3. I gettoni della città, materializzati
-- ---------------------------------------------------------------------------

alter table public.cities
  add column if not exists coverage_keys text[] not null default '{}';

create or replace function private.set_city_coverage_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.coverage_keys := array_remove(array[
    'city:' || new.slug,
    case when new.province is not null
         then 'prov:' || private.slugify(new.province) end,
    case when new.region is not null
         then 'reg:' || private.slugify(new.region) end,
    case when new.macro_region is not null
         then 'macro:' || private.slugify(new.macro_region) end,
    'it:*'
  ], null);
  return new;
end;
$$;

drop trigger if exists set_city_coverage_keys on public.cities;
create trigger set_city_coverage_keys
  before insert or update on public.cities
  for each row execute function private.set_city_coverage_keys();

-- Riempie le città esistenti passando dal trigger, così esiste una sola
-- definizione di come si compone un gettone.
update public.cities set slug = slug;

create index if not exists cities_coverage_keys_idx
  on public.cities using gin (coverage_keys);
