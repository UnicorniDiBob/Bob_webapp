-- 024: data di nascita + accettazione termini in fase di iscrizione, gerarchia
-- geografica sulle città per l'analisi KPI admin.
--
-- Perché:
-- - Vogliamo raccogliere la data di nascita al signup (per verificare la
--   maggiore età) e registrare quando l'utente ha accettato termini/privacy.
--   Entrambi i campi vivono su `profiles` perché il trigger handle_new_user
--   crea già una riga profiles per OGNI utente (cliente o professionista).
-- - Gli inviti staff (admin/cs, vedi /api/admin/staff) usano lo stesso
--   trigger ma NON passano questi dati: le colonne restano quindi nullable,
--   il "required" si applica solo lato form di iscrizione pubblica.
-- - Per gli account già attivi non abbiamo la vera data di nascita: come da
--   decisione presa, li trattiamo come maggiorenni già confermati. Non
--   potendo inventare una data reale, usiamo un placeholder sufficientemente
--   nel passato (creazione account - 20 anni) così il calcolo età risulta
--   sempre >18 e resta coerente nel tempo. terms_accepted_at viene
--   retrodatato a created_at (i termini erano già linkati in fondo al form
--   di login, quindi l'accettazione implicita esisteva anche prima di questo
--   campo esplicito).
-- - cities guadagna provincia/regione/macro-area (nord/centro/sud) per poter
--   filtrare i KPI su più livelli geografici. Le KPI usano però la città
--   della RICHIESTA (requests.city_id), non quella del professionista che
--   risponde: in centri piccoli le due possono differere.
--
-- Idempotente: add column if not exists, update solo dove nullo, create or
-- replace function.

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists terms_accepted_at timestamptz;

update public.profiles
set date_of_birth = coalesce(date_of_birth, (created_at - interval '20 years')::date),
    terms_accepted_at = coalesce(terms_accepted_at, created_at)
where date_of_birth is null or terms_accepted_at is null;

alter table public.cities
  add column if not exists province text,
  add column if not exists region text,
  add column if not exists macro_region text;

alter table public.cities
  drop constraint if exists cities_macro_region_check;
alter table public.cities
  add constraint cities_macro_region_check
  check (macro_region is null or macro_region in ('nord', 'centro', 'sud'));

update public.cities set province = 'Milano', region = 'Lombardia', macro_region = 'nord' where slug = 'milano' and province is null;
update public.cities set province = 'Roma', region = 'Lazio', macro_region = 'centro' where slug = 'roma' and province is null;
update public.cities set province = 'Torino', region = 'Piemonte', macro_region = 'nord' where slug = 'torino' and province is null;

-- Trigger di signup: stessa logica di 002, con in più date_of_birth e
-- terms_accepted_at letti da raw_user_meta_data quando presenti (form
-- pubblico di iscrizione). Se assenti (es. invito staff), niente default
-- forzato: restano null, coerente con la nullability sopra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'customer')
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id, full_name, date_of_birth, terms_accepted_at)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    case
      when nullif(new.raw_user_meta_data->>'terms_accepted_at', '') is not null
        then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      else null
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
