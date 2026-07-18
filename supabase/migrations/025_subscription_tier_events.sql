-- 025: storico dei cambi di abbonamento dei professionisti.
--
-- Perché: la pagina admin "Analisi" deve mostrare quante persone
-- rinunciano a Pro/Business (disdette) oltre alle conversioni. Il campo
-- professionals.subscription_tier è solo uno snapshot: senza uno storico
-- non possiamo distinguere chi non si è mai abbonato da chi ha annullato.
-- Questo trigger registra ogni variazione di tier da oggi in avanti — i
-- cambi precedenti a questa migration non sono ricostruibili.
--
-- Lettura riservata a staff (admin/cs) via RLS; l'insert avviene solo dal
-- trigger (security definer), nessuna policy di insert pubblica.
--
-- Idempotente: create table if not exists, drop-then-create per
-- policy/trigger, create or replace per la funzione.

create table if not exists public.subscription_tier_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  old_tier text not null,
  new_tier text not null,
  changed_at timestamptz not null default now()
);

alter table public.subscription_tier_events enable row level security;

create index if not exists subscription_tier_events_professional_idx
  on public.subscription_tier_events (professional_id);
create index if not exists subscription_tier_events_changed_at_idx
  on public.subscription_tier_events (changed_at);

drop policy if exists "Staff reads tier events" on public.subscription_tier_events;
create policy "Staff reads tier events" on public.subscription_tier_events
  for select using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.role in ('admin', 'cs')
    )
  );

create or replace function public.log_subscription_tier_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subscription_tier is distinct from old.subscription_tier then
    insert into public.subscription_tier_events (professional_id, old_tier, new_tier)
    values (new.id, old.subscription_tier, new.subscription_tier);
  end if;
  return new;
end;
$$;

drop trigger if exists on_subscription_tier_change on public.professionals;
create trigger on_subscription_tier_change
  after update of subscription_tier on public.professionals
  for each row execute function public.log_subscription_tier_change();
