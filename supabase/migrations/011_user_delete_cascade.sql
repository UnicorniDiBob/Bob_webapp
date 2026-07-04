-- Permette l'eliminazione completa di un utente: le righe collegate
-- vengono eliminate a cascata invece di bloccare il delete.
-- (Applicata su Supabase il 2026-07-04.)
alter table public.requests
  drop constraint requests_customer_id_fkey,
  add constraint requests_customer_id_fkey
    foreign key (customer_id) references public.users(id) on delete cascade;

alter table public.ratings
  drop constraint ratings_customer_id_fkey,
  add constraint ratings_customer_id_fkey
    foreign key (customer_id) references public.users(id) on delete cascade;

alter table public.request_professionals
  drop constraint request_professionals_professional_id_fkey,
  add constraint request_professionals_professional_id_fkey
    foreign key (professional_id) references public.professionals(id) on delete cascade;
