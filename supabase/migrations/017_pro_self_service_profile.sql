-- 016: self-service del profilo professionista.
-- I pro possono creare e aggiornare il PROPRIO profilo e i propri servizi/prezzi.
-- Le colonne sensibili (verifica, tier, user_id) restano riservate ad admin/cs
-- tramite trigger; l'INSERT forza lo stato non verificato e il piano free.

-- Un solo profilo professionista per utente.
create unique index if not exists professionals_one_per_user
  on public.professionals (user_id);

-- Trigger: blocca ai non-admin le modifiche alle colonne protette.
create or replace function public.protect_professional_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_cs() then
    if new.verification_status is distinct from old.verification_status
       or new.subscription_tier is distinct from old.subscription_tier
       or new.user_id is distinct from old.user_id then
      raise exception 'Non puoi modificare stato di verifica, piano o proprietario del profilo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_professional_columns on public.professionals;
create trigger protect_professional_columns
  before update on public.professionals
  for each row execute function public.protect_professional_columns();

-- Il pro aggiorna il proprio profilo (trigger sopra protegge le colonne sensibili).
drop policy if exists "Pro updates own profile" on public.professionals;
create policy "Pro updates own profile"
on public.professionals for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Onboarding: un utente con ruolo professional crea il proprio profilo,
-- necessariamente non verificato e sul piano free.
drop policy if exists "Pro creates own profile" on public.professionals;
create policy "Pro creates own profile"
on public.professionals for insert
with check (
  user_id = auth.uid()
  and verification_status = 'unverified'
  and subscription_tier = 'free'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'professional'
  )
);

-- Il pro gestisce i propri servizi e prezzi.
drop policy if exists "Pro manages own services" on public.professional_services;
create policy "Pro manages own services"
on public.professional_services for all
using (professional_id in (select my_professional_ids()))
with check (professional_id in (select my_professional_ids()));
