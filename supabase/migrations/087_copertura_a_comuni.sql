-- 087: la copertura impara il comune.
--
-- PERCHÉ
-- Dalla 086 i comuni esistono in database, ma la copertura non sa cosa farsene:
-- un professionista può ancora dire solo «questi quartieri di Milano», «tutta
-- Milano», «tutta la provincia». Chi ha la base a Sesto San Giovanni e gira
-- entro dieci chilometri non ha modo di dirlo — e il cliente di Cologno
-- Monzese, che pure ce l'ha a quattro chilometri, non lo incontrerà mai.
-- Qui il cerchio che il professionista ha già disegnato comincia a produrre
-- anche i comuni che tocca, e il gettone `comune:<istat>` entra nel confronto
-- accanto a `zone:`, `city:`, `prov:`.
--
-- LE DUE GRIGLIE, E LA REGOLA CHE LE TIENE SEPARATE
-- Dentro una città che ha i suoi quartieri si copre a quartieri; fuori si copre
-- a comuni. Quindi un cerchio che tocca Milano NON produce «comune: Milano»:
-- produce i nuclei che tocca davvero. Senza questa esclusione un idraulico di
-- Sesto il cui cerchio sfiora il confine nord si troverebbe a dichiarare tutta
-- Milano, Gratosoglio compresa, che sta quindici chilometri più in là. La
-- regola non è scritta nel codice: è `cities.comune_istat` (086) più
-- l'esistenza di righe in `city_zones`, cioè due dati.
--
-- IL CERCHIO PRODUCE TUTTI E DUE, SEMPRE
-- Non c'è da scegliere «disegno a quartieri» o «disegno a comuni»: un cerchio è
-- un cerchio, e quello che ci cade dentro sono i quartieri della sua città e i
-- comuni intorno. L'ambito (`scope`) resta la dichiarazione di quanto vasto sia
-- il raggio d'azione, non il modo di calcolarlo.
--
-- COSA NON FA
-- Non tocca l'interfaccia: qui il professionista non può ancora scegliere i
-- comuni a mano, e quello che vede resta il cerchio. La colonna e i gettoni
-- però esistono da adesso, così quando arriva la mappa (blocco 5) non c'è da
-- migrare niente sotto i piedi di nessuno.
--
-- CONFORMITÀ
-- Nessun dato nuovo sulla persona: i comuni coperti sono una conseguenza del
-- cerchio, che già esiste e resta privato. Pubblici restano solo i gettoni
-- (professional_coverage_public), e un gettone di comune dice «lavoro a
-- Cologno», non dove abita chi lo lavora. Stessa riga di RoPA dell'area di
-- lavoro, nessuna finalità nuova, nessun trigger DPIA.
--
-- Idempotente: add column if not exists, drop-then-create dei vincoli,
-- create or replace delle funzioni, ricalcolo finale che passa dai trigger.

-- ---------------------------------------------------------------------------
-- 1. La colonna, e l'ambito nuovo
-- ---------------------------------------------------------------------------

alter table public.professional_coverage
  add column if not exists comuni_istat text[] not null default '{}';

comment on column public.professional_coverage.comuni_istat is
  'I comuni coperti, per codice ISTAT. In modo cerchio li calcola il trigger da private.comuni_nel_cerchio; i comuni che sono città di Bob con i propri quartieri restano fuori, perché lì si copre a quartieri. Privata come il resto della riga: in pubblico escono solo i gettoni.';

create index if not exists professional_coverage_comuni_idx
  on public.professional_coverage using gin (comuni_istat);

alter table public.professional_coverage drop constraint if exists professional_coverage_scope_check;
alter table public.professional_coverage add constraint professional_coverage_scope_check check (
  scope in ('zones', 'comuni', 'city', 'province', 'region', 'macro_region', 'national')
);

-- Il catalogo dice fin dove può arrivare un mestiere: «comuni» sta fra i
-- quartieri e la città, e va accettato anche lì o un servizio con tetto
-- 'city' non potrebbe dichiarare qualcosa di più stretto.
alter table public.services drop constraint if exists services_max_coverage_scope_check;
alter table public.services add constraint services_max_coverage_scope_check check (
  max_coverage_scope is null or max_coverage_scope in
    ('zones', 'comuni', 'city', 'province', 'region', 'macro_region', 'national')
);

-- ---------------------------------------------------------------------------
-- 2. Il cerchio calcola anche i comuni
-- ---------------------------------------------------------------------------

create or replace function public.sync_coverage_zones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $BODY$
begin
  if new.mode = 'circle'
     and new.center_lat is not null
     and new.center_lng is not null
     and new.radius_m is not null then

    -- I quartieri: solo quelli della città della riga, come dalla 057.
    if new.city_id is not null then
      new.zone_slugs := private.zones_in_circle(
        new.city_id, new.center_lat, new.center_lng, new.radius_m);
    end if;

    -- I comuni: tutti quelli che cadono nel cerchio, tolti quelli che sono
    -- città di Bob con i propri quartieri. Lì vale il livello fine, e
    -- dichiarare il comune intero sarebbe dire il falso.
    new.comuni_istat := (
      select coalesce(array_agg(m order by m), '{}')
        from unnest(private.comuni_nel_cerchio(
               new.center_lat, new.center_lng, new.radius_m)) as m
       where not exists (
         select 1
           from public.cities c
           join public.city_zones z on z.city_id = c.id
          where c.comune_istat = m
       )
    );
  end if;

  new.updated_at := now();
  return new;
end;
$BODY$;

revoke all on function public.sync_coverage_zones() from public;
revoke all on function public.sync_coverage_zones() from anon;
revoke all on function public.sync_coverage_zones() from authenticated;

-- ---------------------------------------------------------------------------
-- 3. I gettoni: il comune entra nel confronto
-- ---------------------------------------------------------------------------

create or replace function private.coverage_keys_for(p_coverage_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $BODY$
declare
  r record;
  keys text[] := '{}';
  z text;
  g text;
  m text;
begin
  select c.scope, c.zone_slugs, c.comuni_istat, c.works_remote, c.city_id,
         ci.slug as city_slug, ci.province, ci.region, ci.macro_region
    into r
    from public.professional_coverage c
    left join public.cities ci on ci.id = c.city_id
   where c.id = p_coverage_id;

  if not found then
    return '{}';
  end if;

  if r.works_remote then
    keys := keys || 'remote:*'::text;
  end if;

  if r.scope = 'national' then
    return keys || 'it:*'::text;
  elsif r.scope = 'macro_region' then
    return keys || ('macro:' || private.slugify(r.macro_region));
  elsif r.scope = 'region' then
    return keys || ('reg:' || private.slugify(r.region));
  elsif r.scope = 'province' then
    return keys || ('prov:' || private.slugify(r.province));
  elsif r.scope = 'city' then
    return keys || ('city:' || r.city_slug);
  end if;

  -- scope 'zones' o 'comuni': un gettone per nucleo, con la città nel nome
  -- perché "centro" esiste in ogni città d'Italia.
  foreach z in array coalesce(r.zone_slugs, '{}') loop
    keys := keys || ('zone:' || r.city_slug || '/' || z);
  end loop;

  -- E uno per ogni gruppo toccato: il cliente in chat sceglie ancora i nomi
  -- corti, e senza questo pezzo la sua richiesta non troverebbe nessuno.
  for g in
    select distinct zz.group_slug
      from public.city_zones zz
     where zz.city_id = r.city_id
       and zz.group_slug is not null
       and zz.slug = any(coalesce(r.zone_slugs, '{}'))
  loop
    keys := keys || ('zone:' || r.city_slug || '/' || g);
  end loop;

  -- I comuni: il codice ISTAT e non il nome, perché i nomi cambiano con le
  -- fusioni e un gettone che cambia nome è un gettone che smette di incontrare
  -- le richieste vecchie.
  foreach m in array coalesce(r.comuni_istat, '{}') loop
    keys := keys || ('comune:' || m);
  end loop;

  return keys;
end;
$BODY$;

-- ---------------------------------------------------------------------------
-- 4. L'ambito più stretto, per l'ordinamento
-- ---------------------------------------------------------------------------

create or replace function public.publish_coverage_keys()
returns trigger
language plpgsql
security definer
set search_path = ''
as $BODY$
declare
  pid uuid;
  all_keys text[];
  best text;
begin
  pid := coalesce(new.professional_id, old.professional_id);

  select coalesce(array_agg(distinct k), '{}')
    into all_keys
    from public.professional_coverage c,
         unnest(private.coverage_keys_for(c.id)) as k
   where c.professional_id = pid;

  select c.scope
    into best
    from public.professional_coverage c
   where c.professional_id = pid
   order by array_position(
     array['zones', 'comuni', 'city', 'province', 'region', 'macro_region', 'national'],
     c.scope)
   limit 1;

  if all_keys = '{}' then
    delete from public.professional_coverage_public where professional_id = pid;
    return coalesce(new, old);
  end if;

  insert into public.professional_coverage_public
    (professional_id, coverage_keys, best_scope, updated_at)
  values (pid, all_keys, best, now())
  on conflict (professional_id) do update
    set coverage_keys = excluded.coverage_keys,
        best_scope = excluded.best_scope,
        updated_at = now();

  return coalesce(new, old);
end;
$BODY$;

revoke all on function public.publish_coverage_keys() from public;
revoke all on function public.publish_coverage_keys() from anon;
revoke all on function public.publish_coverage_keys() from authenticated;

-- ---------------------------------------------------------------------------
-- 5. La richiesta porta il gettone del suo comune
-- ---------------------------------------------------------------------------
--
-- I gettoni della città stanno materializzati su cities.coverage_keys dalla
-- 058, e da lì li legge il client: aggiungerlo qui vuol dire che una richiesta
-- da Milano porta `comune:015146` senza che nessuno riscriva una riga di
-- TypeScript. Serve a chi dichiara Milano fra i comuni — e servirà, dal blocco
-- 6, alle richieste che arrivano da un comune qualsiasi.

create or replace function private.set_city_coverage_keys()
returns trigger
language plpgsql
set search_path = ''
as $BODY$
begin
  new.coverage_keys := array_remove(array[
    'city:' || new.slug,
    case when new.comune_istat is not null
         then 'comune:' || new.comune_istat end,
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
$BODY$;

-- ---------------------------------------------------------------------------
-- 6. Ricalcolo: i cerchi ridisegnano, i gettoni si riscrivono
-- ---------------------------------------------------------------------------

-- cities non ha updated_at: si riscrive lo slug con se stesso, che basta a
-- far passare la riga dal trigger.
update public.cities set slug = slug;
update public.professional_coverage set updated_at = now();
