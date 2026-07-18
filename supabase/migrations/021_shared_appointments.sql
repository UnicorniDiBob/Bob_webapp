-- 021: appuntamenti condivisi cliente <-> pro.
-- Perché: la dashboard cliente mostra i prossimi appuntamenti e permette di
-- confermare/rifiutare le proposte del pro (che le crea da /messaggi).
-- La tabella appointments aveva già request_id: qui aggiungiamo gli stati
-- 'proposed'/'declined', la visibilità per il cliente della richiesta
-- collegata e un guard che limita il cliente alla sola risposta.
-- Idempotente: drop-then-create per constraint/policy/trigger.

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status = any (array[
    'proposed'::text, 'confirmed'::text, 'completed'::text,
    'cancelled'::text, 'declined'::text
  ]));

-- Il cliente vede gli appuntamenti agganciati alle proprie richieste.
drop policy if exists "Customer reads own request appointments" on public.appointments;
create policy "Customer reads own request appointments" on public.appointments
  for select using (
    request_id in (
      select id from public.requests where customer_id = (select auth.uid())
    )
  );

-- Il cliente può aggiornare (il trigger sotto limita a conferma/rifiuto).
drop policy if exists "Customer responds to proposed appointments" on public.appointments;
create policy "Customer responds to proposed appointments" on public.appointments
  for update using (
    request_id in (
      select id from public.requests where customer_id = (select auth.uid())
    )
  )
  with check (
    request_id in (
      select id from public.requests where customer_id = (select auth.uid())
    )
  );

-- Guard: chi non è il pro proprietario (né service role) può solo passare
-- una proposta a confirmed/declined, senza toccare gli altri campi.
create or replace function public.appointments_customer_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  if auth.uid() is null then
    return new; -- service role / job interni
  end if;
  select exists (
    select 1 from public.professionals p
    where p.id = old.professional_id and p.user_id = auth.uid()
  ) into is_owner;
  if is_owner then
    return new;
  end if;
  if old.status <> 'proposed'
     or new.status not in ('confirmed', 'declined')
     or new.professional_id is distinct from old.professional_id
     or new.request_id is distinct from old.request_id
     or new.customer_name is distinct from old.customer_name
     or new.title is distinct from old.title
     or new.starts_at is distinct from old.starts_at
     or new.duration_minutes is distinct from old.duration_minutes
     or new.price is distinct from old.price
     or new.notes is distinct from old.notes
  then
    raise exception 'Puoi solo confermare o rifiutare una proposta di appuntamento';
  end if;
  return new;
end $$;

drop trigger if exists appointments_customer_guard on public.appointments;
create trigger appointments_customer_guard
  before update on public.appointments
  for each row execute function public.appointments_customer_guard();
