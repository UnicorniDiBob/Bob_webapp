-- 057: primo ingresso del professionista — copertura geografica, unità di
-- misura, costi accessori, stato "pronto a ricevere richieste".
--
-- PERCHÉ, in cinque pezzi.
--
-- 1. LE ZONE IN DATABASE. Finora le 28 zone di Milano vivevano solo in
--    src/lib/zones.ts (centroidi NIL del Comune, CC-BY). Vanno anche in
--    tabella per due ragioni: le città nuove devono entrare senza un deploy,
--    e "quali zone cadono nel cerchio che il pro ha disegnato" si calcola
--    lato server, non nel browser. Le slug sono IDENTICHE a quelle del file,
--    generate dallo stesso script (scripts/gen_seed_zone_milano.mjs): il
--    percorso del cliente continua a usare il file, e il match fra i due lati
--    funziona perché la chiave è la stessa stringa.
--
-- 2. LA COPERTURA, IN DUE TABELLE. Il centro del cerchio può essere
--    l'abitazione del professionista: pubblicare centro e raggio
--    pubblicherebbe casa sua. Quindi la geometria sta in una tabella privata
--    (proprietario + staff) e SOLO l'elenco delle aree diventa pubblico, in
--    una seconda tabella scritta da un trigger. Non una vista: una vista che
--    scavalca la RLS della tabella base è esattamente il rilievo
--    "SECURITY DEFINER view" degli advisor.
--
-- 3. UNA SOLA CHIAVE DI MATCH, PER OGNI AMPIEZZA. "Lavoro nei Navigli",
--    "in tutta la provincia", "in tutta Italia" diventano gettoni:
--    zone:milano/navigli, city:milano, prov:milano, reg:lombardia,
--    macro:nord, it:*. La richiesta genera i propri gettoni dalla città
--    (le colonne province/region/macro_region su cities esistono già) e il
--    match è una sola intersezione fra due array, con indice GIN. "Tutta
--    Italia" non è un caso speciale nel codice: è un gettone.
--
-- 4. FIN DOVE PUÒ ARRIVARE UNA COPERTURA LO DECIDE IL CATALOGO. Un fotografo
--    che copre l'Italia è normale; un idraulico che dice lo stesso è una
--    richiesta persa per il cliente. services.max_coverage_scope, come per
--    l'unità di misura: la proprietà appartiene al lavoro, non al pro.
--
-- 5. NIENTE POSTGIS, PER ORA. Le zone di una città sono decine: l'emisenoverso
--    in SQL basta. PostGIS 3.3.7 è disponibile sul progetto e non è
--    installato: si installerà quando le richieste avranno un punto vero
--    (geocoder, roadmap 40.0), senza toccare questo modello.
--
-- PRIVACY (DATA_COMPLIANCE §2). Base giuridica: contratto, art. 6(1)(b) —
-- senza mestiere, copertura e tariffa il servizio non può proporre il
-- professionista a nessuno. Dati personali per le ditte individuali:
-- pubblici i gettoni, privata la geometria. Retention: vita del profilo,
-- cancellazione a cascata con l'account. Nessun fornitore nuovo. Righe RoPA
-- nello stesso commit.
--
-- Idempotente: create ... if not exists, add column if not exists,
-- drop-then-create per policy e trigger, on conflict per il seed.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- 0. Slugify: la stessa stringa dai due lati, o i gettoni non si incontrano.
-- ---------------------------------------------------------------------------

create or replace function private.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_text is null then null
    else trim(both '-' from regexp_replace(
      lower(translate(p_text,
        'àáâäãèéêëìíîïòóôöõùúûüçñ''’ ',
        'aaaaaeeeeiiiiooooouuuucn---')),
      '[^a-z0-9]+', '-', 'g'))
  end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Le zone delle città
-- ---------------------------------------------------------------------------

create table if not exists public.city_zones (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  slug text not null,
  label text not null,
  lat double precision,
  lng double precision,
  source text,
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

alter table public.city_zones enable row level security;

-- Geografia pubblica: nessun dato personale, lettura per tutti.
drop policy if exists "Anyone reads city zones" on public.city_zones;
create policy "Anyone reads city zones" on public.city_zones
  for select using (true);

drop policy if exists "Staff manages city zones" on public.city_zones;
create policy "Staff manages city zones" on public.city_zones
  for all using (private.is_admin_or_cs()) with check (private.is_admin_or_cs());

-- ---------------------------------------------------------------------------
-- 2. Fin dove può arrivare una copertura: lo dice il catalogo
-- ---------------------------------------------------------------------------

alter table public.services
  add column if not exists max_coverage_scope text,
  add column if not exists remote_possible boolean not null default false;

alter table public.services drop constraint if exists services_max_coverage_scope_check;
alter table public.services add constraint services_max_coverage_scope_check check (
  max_coverage_scope is null or max_coverage_scope in
    ('zones', 'city', 'province', 'region', 'macro_region', 'national')
);

-- ---------------------------------------------------------------------------
-- 3. La copertura: il disegno. Privata.
-- ---------------------------------------------------------------------------

create table if not exists public.professional_coverage (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  scope text not null default 'zones',
  city_id uuid references public.cities (id) on delete cascade,
  mode text not null default 'zones',
  zone_slugs text[] not null default '{}',
  center_lat double precision,
  center_lng double precision,
  radius_m integer,
  area_geojson jsonb,
  works_remote boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.professional_coverage drop constraint if exists professional_coverage_scope_check;
alter table public.professional_coverage add constraint professional_coverage_scope_check check (
  scope in ('zones', 'city', 'province', 'region', 'macro_region', 'national')
);

alter table public.professional_coverage drop constraint if exists professional_coverage_mode_check;
alter table public.professional_coverage add constraint professional_coverage_mode_check check (
  mode in ('zones', 'circle', 'polygon')
);

alter table public.professional_coverage drop constraint if exists professional_coverage_radius_check;
alter table public.professional_coverage add constraint professional_coverage_radius_check check (
  radius_m is null or (radius_m between 250 and 200000)
);

-- Gli ambiti fino alla regione partono da una città; il nazionale no.
alter table public.professional_coverage drop constraint if exists professional_coverage_citta_richiesta;
alter table public.professional_coverage add constraint professional_coverage_citta_richiesta check (
  scope = 'national' or city_id is not null
);

-- Una riga per (professionista, ambito, città). L'uuid zero sta per
-- "nessuna città": in un indice unico NULL non è uguale a NULL, quindi senza
-- coalesce si potrebbero inserire due coperture nazionali identiche.
create unique index if not exists professional_coverage_unica
  on public.professional_coverage (
    professional_id, scope,
    coalesce(city_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists professional_coverage_pro_idx
  on public.professional_coverage (professional_id);

alter table public.professional_coverage enable row level security;

drop policy if exists "Pro manages own coverage" on public.professional_coverage;
create policy "Pro manages own coverage" on public.professional_coverage
  for all using (professional_id in (select private.my_professional_ids()))
  with check (professional_id in (select private.my_professional_ids()));

drop policy if exists "Staff reads coverage" on public.professional_coverage;
create policy "Staff reads coverage" on public.professional_coverage
  for select using (private.is_admin_or_cs());

-- ---------------------------------------------------------------------------
-- 4. La copertura: i gettoni. Pubblica, e sola lettura per tutti.
--    Nessuna policy di scrittura: la riempie soltanto il trigger.
-- ---------------------------------------------------------------------------

create table if not exists public.professional_coverage_public (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  coverage_keys text[] not null default '{}',
  best_scope text,
  updated_at timestamptz not null default now()
);

alter table public.professional_coverage_public enable row level security;

drop policy if exists "Anyone reads coverage keys" on public.professional_coverage_public;
create policy "Anyone reads coverage keys" on public.professional_coverage_public
  for select using (true);

create index if not exists professional_coverage_public_keys_idx
  on public.professional_coverage_public using gin (coverage_keys);

-- ---------------------------------------------------------------------------
-- 5. Quali zone cadono nel cerchio (emisenoverso, metri)
-- ---------------------------------------------------------------------------

create or replace function private.zones_in_circle(
  p_city_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(z.slug order by z.slug), '{}')
  from public.city_zones z
  where z.city_id = p_city_id
    and z.lat is not null
    and z.lng is not null
    and 6371000 * 2 * asin(sqrt(
          power(sin(radians(z.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(z.lat))
            * power(sin(radians(z.lng - p_lng) / 2), 2)
        )) <= p_radius_m;
$$;

-- ---------------------------------------------------------------------------
-- 6. I gettoni di una riga di copertura
-- ---------------------------------------------------------------------------

create or replace function private.coverage_keys_for(p_coverage_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  keys text[] := '{}';
  z text;
begin
  select c.scope, c.zone_slugs, c.works_remote,
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

  -- scope = 'zones': un gettone per zona, con la città nel nome perché
  -- "centro" esiste in ogni città d'Italia.
  foreach z in array r.zone_slugs loop
    keys := keys || ('zone:' || r.city_slug || '/' || z);
  end loop;

  return keys;
end;
$$;

-- I gettoni di una richiesta: stessa funzione di slugify, o i due elenchi
-- non si incontrano. p_zone_slug è la zona dichiarata dal cliente, se c'è.
create or replace function public.request_coverage_keys(
  p_city_id uuid,
  p_zone_slug text default null
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when p_zone_slug is not null and c.slug is not null
         then 'zone:' || c.slug || '/' || p_zone_slug end,
    'city:' || c.slug,
    'prov:' || private.slugify(c.province),
    'reg:' || private.slugify(c.region),
    'macro:' || private.slugify(c.macro_region),
    'it:*'
  ], null)
  from public.cities c
  where c.id = p_city_id;
$$;

revoke all on function public.request_coverage_keys(uuid, text) from public;
grant execute on function public.request_coverage_keys(uuid, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 7. Il cerchio si traduce in zone alla scrittura, non alla lettura
-- ---------------------------------------------------------------------------

create or replace function public.sync_coverage_zones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mode = 'circle'
     and new.center_lat is not null
     and new.center_lng is not null
     and new.radius_m is not null
     and new.city_id is not null then
    new.zone_slugs := private.zones_in_circle(
      new.city_id, new.center_lat, new.center_lng, new.radius_m);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_coverage_zones on public.professional_coverage;
create trigger sync_coverage_zones
  before insert or update on public.professional_coverage
  for each row execute function public.sync_coverage_zones();

-- ---------------------------------------------------------------------------
-- 8. Solo i gettoni diventano pubblici. Mai centro e raggio.
-- ---------------------------------------------------------------------------

create or replace function public.publish_coverage_keys()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
     array['zones', 'city', 'province', 'region', 'macro_region', 'national'],
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
$$;

drop trigger if exists publish_coverage_keys on public.professional_coverage;
create trigger publish_coverage_keys
  after insert or update or delete on public.professional_coverage
  for each row execute function public.publish_coverage_keys();

-- ---------------------------------------------------------------------------
-- 9. Unità di misura: il fotografo lavora a evento, non a ora
-- ---------------------------------------------------------------------------

alter table public.professional_services
  drop constraint if exists professional_services_rate_unit_check;
alter table public.professional_services
  add constraint professional_services_rate_unit_check check (
    rate_unit is null or rate_unit in
    ('hour', 'day', 'half_day', 'event', 'job', 'session',
     'm2', 'linear_m', 'point', 'piece', 'quote')
  );

alter table public.subservices
  drop constraint if exists subservices_default_rate_unit_check;
alter table public.subservices
  add constraint subservices_default_rate_unit_check check (
    default_rate_unit is null or default_rate_unit in
    ('hour', 'day', 'half_day', 'event', 'job', 'session',
     'm2', 'linear_m', 'point', 'piece', 'quote')
  );

-- ---------------------------------------------------------------------------
-- 10. Costi accessori: dichiarati una volta, pubblici come il prezzo
-- ---------------------------------------------------------------------------

alter table public.professionals
  add column if not exists callout_fee numeric,
  add column if not exists callout_fee_deducted boolean not null default false,
  add column if not exists survey_free boolean not null default true,
  add column if not exists survey_fee numeric,
  add column if not exists min_billable_units numeric,
  add column if not exists materials_included boolean,
  add column if not exists vat_regime text;

alter table public.professionals drop constraint if exists professionals_callout_fee_check;
alter table public.professionals add constraint professionals_callout_fee_check
  check (callout_fee is null or callout_fee >= 0);

alter table public.professionals drop constraint if exists professionals_survey_fee_check;
alter table public.professionals add constraint professionals_survey_fee_check
  check (survey_fee is null or survey_fee >= 0);

alter table public.professionals drop constraint if exists professionals_min_billable_check;
alter table public.professionals add constraint professionals_min_billable_check
  check (min_billable_units is null or min_billable_units > 0);

alter table public.professionals drop constraint if exists professionals_vat_regime_check;
alter table public.professionals add constraint professionals_vat_regime_check
  check (vat_regime is null or vat_regime in ('22', '10', 'forfettario'));

-- ---------------------------------------------------------------------------
-- 11. Lo stato del primo ingresso: dichiarato, non dedotto
-- ---------------------------------------------------------------------------

alter table public.professionals
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists ready_at timestamptz;

-- Colonne che il professionista NON deve poter scrivere da se'. Il trigger
-- della 017 protegge gia' verifica, livello, piano e proprietario: qui si
-- RIPETE quell'elenco per intero e si aggiunge ready_at, altrimenti
-- "pronto a ricevere richieste" lo si dichiarerebbe da soli con una chiamata
-- REST. La guardia su auth.uid() is not null resta: il service role (le route
-- server) deve poter scrivere, ed e' cosi' che il primo ingresso segna lo
-- stato quando i requisiti minimi ci sono davvero.
create or replace function public.protect_professional_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.is_admin_or_cs() then
    if new.verification_status is distinct from old.verification_status
       or new.subscription_tier is distinct from old.subscription_tier
       or new.user_id is distinct from old.user_id
       or new.verification_level is distinct from old.verification_level
       or new.verification_level_at is distinct from old.verification_level_at
       or new.ready_at is distinct from old.ready_at then
      raise exception 'Non puoi modificare stato di verifica, livello, piano, proprietario o pubblicazione del profilo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_professional_columns on public.professionals;
create trigger protect_professional_columns
  before update on public.professionals
  for each row execute function public.protect_professional_columns();

-- ---------------------------------------------------------------------------
-- 12. Seed delle zone di Milano
-- ---------------------------------------------------------------------------

-- 28 zone, generate da src/lib/zones.ts (dataset NIL del Comune di Milano, CC-BY).
insert into public.city_zones (city_id, slug, label, lat, lng, source)
select c.id, v.slug, v.label, v.lat, v.lng, 'NIL Comune di Milano (CC-BY)'
from public.cities c
cross join (values
  ('centro', 'Centro / Duomo', 45.46371, 9.18695),
  ('brera', 'Brera', 45.47425, 9.18816),
  ('isola', 'Isola', 45.49089, 9.18962),
  ('porta-nuova', 'Porta Nuova / Garibaldi', 45.48359, 9.19058),
  ('porta-venezia', 'Porta Venezia', 45.47703, 9.21449),
  ('porta-romana', 'Porta Romana', 45.46322, 9.20189),
  ('navigli', 'Navigli', 45.43742, 9.15352),
  ('ticinese', 'Ticinese', 45.4495, 9.17528),
  ('sempione', 'Sempione / Arco della Pace', 45.47413, 9.17625),
  ('citta-studi', 'Città Studi', 45.47727, 9.23082),
  ('lambrate', 'Lambrate', 45.47929, 9.24966),
  ('bicocca', 'Bicocca', 45.51898, 9.21281),
  ('bovisa', 'Bovisa', 45.51062, 9.15835),
  ('affori', 'Affori', 45.51393, 9.17129),
  ('niguarda', 'Niguarda', 45.5167, 9.19612),
  ('greco', 'Greco', 45.50349, 9.20952),
  ('loreto', 'Loreto', 45.49094, 9.22223),
  ('corvetto', 'Corvetto', 45.43648, 9.22845),
  ('rogoredo', 'Rogoredo / Santa Giulia', 45.43667, 9.24352),
  ('barona', 'Barona', 45.43235, 9.15619),
  ('famagosta', 'Famagosta', 45.42994, 9.17844),
  ('san-siro', 'San Siro', 45.47138, 9.13836),
  ('baggio', 'Baggio', 45.4596, 9.08721),
  ('quarto-oggiaro', 'Quarto Oggiaro', 45.51364, 9.13773),
  ('washington', 'Washington / De Angeli', 45.47488, 9.14841),
  ('bande-nere', 'Bande Nere / Lorenteggio', 45.45563, 9.1292),
  ('forlanini', 'Forlanini', 45.45806, 9.25159),
  ('gratosoglio', 'Gratosoglio', 45.41169, 9.17119)
) as v(slug, label, lat, lng)
where c.slug = 'milano'
on conflict (city_id, slug) do update
  set label = excluded.label,
      lat = excluded.lat,
      lng = excluded.lng,
      source = excluded.source,
      updated_at = now();
