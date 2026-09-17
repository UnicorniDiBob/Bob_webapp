-- 088: la richiesta porta il suo comune.
--
-- PERCHÉ
-- Dalla 087 il professionista può coprire i comuni, ma nessuna richiesta sa
-- dire da quale comune arriva: `requests` ha la città di Bob (tre: Milano,
-- Roma, Torino), il quartiere e — dalla 046 — il CAP. Finché resta così, chi
-- copre Cologno Monzese non riceverà mai niente, perché non esiste una
-- richiesta che possa incontrarlo.
--
-- LA SCORCIATOIA CHE C'ERA GIÀ, E CHE NESSUNO AVEVA USATO
-- Il CAP nella richiesta esiste dal 7 agosto. Un CAP è quasi sempre un comune
-- solo: bastano l'elenco della 086 e una funzione per passare dall'uno
-- all'altro, senza toccare la chat — che è area di André — e senza chiedere
-- niente di nuovo al cliente. Il passo «in che città?» che oggi offre tre nomi
-- resta da fare, ed è suo; ma il binario sotto, da oggi, c'è.
--
-- QUANDO IL CAP NON BASTA
-- Alcuni CAP stanno su più comuni. Lì non si indovina: si prende quello che
-- combacia con la città della richiesta, e se non combacia nessuno si lascia
-- vuoto. Una richiesta senza comune continua a funzionare esattamente come
-- prima — città, provincia, regione — mentre un comune sbagliato manderebbe la
-- richiesta a un professionista che sta altrove, e nessuno dei due capirebbe
-- perché.
--
-- SENZA CAP, VALE LA CITTÀ
-- Una richiesta da Milano senza CAP è nel comune di Milano: il gettone si
-- ricava da `cities.comune_istat` (086). Non è un'informazione nuova sul
-- cliente, è la stessa città scritta con l'altro alfabeto.
--
-- CONFORMITÀ
-- Nessun dato nuovo: il comune si ricava dal CAP che il cliente ha già dato
-- (046) o dalla città che ha già scelto. Stessa finalità, stessa base
-- giuridica art. 6(1)(b), stessa riga di RoPA (A2) e stessa conservazione
-- della richiesta: nasce e muore con lei. Grana invariata — comune, non
-- indirizzo. Nessun trigger DPIA.
--
-- Idempotente: add column if not exists, create or replace, trigger
-- drop-then-create, riempimento delle righe esistenti che passa dal trigger.

-- ---------------------------------------------------------------------------
-- 1. La colonna
-- ---------------------------------------------------------------------------

alter table public.requests
  add column if not exists comune_istat text;

alter table public.requests drop constraint if exists requests_comune_istat_format;
alter table public.requests add constraint requests_comune_istat_format check (
  comune_istat is null or comune_istat ~ '^[0-9]{6}$'
);

create index if not exists requests_comune_istat_idx
  on public.requests (comune_istat)
  where comune_istat is not null;

comment on column public.requests.comune_istat is
  'Il comune da cui arriva la richiesta, ricavato dal CAP (046) o dalla città. Non lo scrive il cliente: lo mette il trigger. Vuoto quando il CAP sta su più comuni e nessuno combacia con la città — meglio nessun comune che quello sbagliato.';

-- ---------------------------------------------------------------------------
-- 2. Dal CAP al comune
-- ---------------------------------------------------------------------------

create or replace function private.comune_da_cap(
  p_cap text,
  p_city_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $BODY$
declare
  quanti int;
  scelto text;
  citta record;
begin
  if p_cap is null or p_cap !~ '^[0-9]{5}$' then
    return null;
  end if;

  select count(*) into quanti from public.comuni where cap @> array[p_cap];

  if quanti = 0 then
    -- L'elenco dei CAP non è ufficiale (vedi 085): un CAP che non conosciamo
    -- non è un CAP sbagliato, è solo uno che non abbiamo.
    return null;
  end if;

  if quanti = 1 then
    select istat into scelto from public.comuni where cap @> array[p_cap];
    return scelto;
  end if;

  -- Più comuni con lo stesso CAP: decide la città della richiesta.
  if p_city_id is null then
    return null;
  end if;

  select c.comune_istat, c.province into citta
    from public.cities c where c.id = p_city_id;

  if citta.comune_istat is not null then
    select istat into scelto
      from public.comuni
     where cap @> array[p_cap] and istat = citta.comune_istat;
    if scelto is not null then
      return scelto;
    end if;
  end if;

  -- Stessa provincia: un CAP condiviso fra comuni confinanti resta deciso.
  -- Se anche così restano in due, non si indovina.
  select istat into scelto
    from public.comuni
   where cap @> array[p_cap] and provincia = citta.province
   limit 2;

  if (select count(*) from public.comuni
       where cap @> array[p_cap] and provincia = citta.province) = 1 then
    return scelto;
  end if;

  return null;
end;
$BODY$;

revoke all on function private.comune_da_cap(text, uuid) from public;

-- ---------------------------------------------------------------------------
-- 3. Il trigger: la richiesta si porta dietro il comune da sola
-- ---------------------------------------------------------------------------

create or replace function public.set_request_comune()
returns trigger
language plpgsql
security definer
set search_path = ''
as $BODY$
begin
  -- Se qualcuno l'ha già scritto, si rispetta: il giorno che la chat chiederà
  -- il comune per nome, sarà lei ad avere ragione.
  if new.comune_istat is not null then
    return new;
  end if;

  -- UN CAP CHE CONOSCIAMO DECIDE, ANCHE QUANDO NON SA DECIDERE.
  -- Se il CAP sta nel nostro elenco, la risposta è sua: il comune se è uno
  -- solo, il vuoto se sono due e nessuno combacia con la città. Ripiegare
  -- sulla città in quel caso vorrebbe dire dire «Milano» a chi ha scritto il
  -- CAP di un paese della cintura, che è proprio l'errore che questa
  -- migrazione esiste per togliere.
  -- Se invece il CAP manca, o non lo conosciamo (l'elenco non è ufficiale),
  -- allora vale la città: è quello che sapevamo prima e resta vero.
  if new.postal_code is not null
     and exists (select 1 from public.comuni where cap @> array[new.postal_code]) then
    new.comune_istat := private.comune_da_cap(new.postal_code, new.city_id);
    return new;
  end if;

  if new.city_id is not null then
    select c.comune_istat into new.comune_istat
      from public.cities c where c.id = new.city_id;
  end if;

  return new;
end;
$BODY$;

revoke all on function public.set_request_comune() from public;
revoke all on function public.set_request_comune() from anon;
revoke all on function public.set_request_comune() from authenticated;

drop trigger if exists set_request_comune on public.requests;
create trigger set_request_comune
  before insert or update of postal_code, city_id on public.requests
  for each row execute function public.set_request_comune();

-- ---------------------------------------------------------------------------
-- 4. Le richieste che ci sono già
-- ---------------------------------------------------------------------------
--
-- Passano dal trigger invece di ripetere qui la stessa logica: una regola
-- scritta in due posti diverge, e diverge in silenzio.

update public.requests
   set postal_code = postal_code
 where comune_istat is null;
