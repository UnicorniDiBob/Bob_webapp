-- 015: recensioni inviabili dai clienti.
-- Colonna request_id per legare la recensione al lavoro, vincolo "una
-- recensione per professionista per richiesta", e policy INSERT che
-- consente la recensione solo al cliente proprietario di una richiesta
-- CONCLUSA verso un professionista effettivamente contattato.

alter table public.ratings
  add column if not exists request_id uuid references public.requests(id) on delete set null;

create unique index if not exists ratings_one_per_request_pro
  on public.ratings (request_id, professional_id)
  where request_id is not null;

drop policy if exists "Customer inserts review for closed request" on public.ratings;
create policy "Customer inserts review for closed request"
on public.ratings for insert
with check (
  customer_id = auth.uid()
  and request_id is not null
  and exists (
    select 1 from public.requests r
    where r.id = ratings.request_id
      and r.customer_id = auth.uid()
      and r.status = 'closed'
  )
  and exists (
    select 1 from public.request_professionals rp
    where rp.request_id = ratings.request_id
      and rp.professional_id = ratings.professional_id
  )
);
