-- 028: registra QUALE versione dei termini l'utente ha accettato.
--
-- Perché: sapere che l'utente ha accettato "i termini" non basta — in caso di
-- contestazione serve poter dimostrare *quale testo* stava leggendo. La
-- costante TERMS_VERSION vive in src/components/TermsContent.tsx e viene
-- incrementata a ogni modifica sostanziale del testo; il valore arriva qui
-- tramite raw_user_meta_data al momento dell'iscrizione.
--
-- La colonna sta in profile_private (non in profiles) per la stessa ragione
-- della migration 027: profiles è leggibile pubblicamente per i professionisti,
-- profile_private no.
--
-- Idempotente: add column if not exists + create or replace della funzione.

alter table public.profile_private
  add column if not exists terms_version text;

-- Trigger di signup: come in 027, con in più terms_version.
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

  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (user_id) do nothing;

  insert into public.profile_private (user_id, date_of_birth, terms_accepted_at, terms_version)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    case
      when nullif(new.raw_user_meta_data->>'terms_accepted_at', '') is not null
        then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      else null
    end,
    nullif(new.raw_user_meta_data->>'terms_version', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
