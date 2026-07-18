-- 022: un thread per coppia richiesta-professionista + brief agganciato.
-- Perché: con le richieste multi-preventivo tutti i messaggi finivano in un
-- unico thread condiviso — i pro vedevano i messaggi rivolti ai concorrenti
-- e il confronto preventivi era impossibile. Ogni messaggio ora appartiene
-- a un professional_id; le RLS dei pro si stringono di conseguenza.
-- In più requests.brief_id: il contesto raccolto da Bob (foto incluse)
-- arriva al professionista invece di perdersi al momento della richiesta.
-- Idempotente: add column if not exists, drop-then-create per policy.

alter table public.request_messages
  add column if not exists professional_id uuid
  references public.professionals (id) on delete set null;

create index if not exists idx_request_messages_thread
  on public.request_messages (request_id, professional_id, created_at);

-- Backfill: ogni messaggio esistente va al primo pro collegato alla richiesta
-- (per le richieste single-pro è esatto; per le multi-pro del pilota è la
-- migliore attribuzione disponibile).
update public.request_messages m
set professional_id = sub.professional_id
from (
  select distinct on (request_id) request_id, professional_id
  from public.request_professionals
  order by request_id, created_at asc
) sub
where m.professional_id is null
  and m.request_id = sub.request_id;

-- RLS pro: vede e scrive solo nel PROPRIO thread (prima: tutta la richiesta).
drop policy if exists "Pro reads assigned messages" on public.request_messages;
create policy "Pro reads assigned messages" on public.request_messages
  for select using (
    professional_id in (select public.my_professional_ids())
  );

drop policy if exists "Pro inserts assigned messages" on public.request_messages;
create policy "Pro inserts assigned messages" on public.request_messages
  for insert with check (
    sender_id = (select auth.uid())
    and professional_id in (select public.my_professional_ids())
    and request_id in (
      select request_id from public.request_professionals
      where professional_id in (select public.my_professional_ids())
    )
  );

drop policy if exists "Pro marks assigned request_messages read" on public.request_messages;
create policy "Pro marks assigned request_messages read" on public.request_messages
  for update using (professional_id in (select public.my_professional_ids()))
  with check (professional_id in (select public.my_professional_ids()));

-- Brief di Bob agganciato alla richiesta.
alter table public.requests
  add column if not exists brief_id uuid
  references public.job_briefs (id) on delete set null;
