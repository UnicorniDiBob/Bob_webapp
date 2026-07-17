-- 020: indirizzi salvati del cliente.
-- Perché: l'account cliente permette di salvare più località ("Casa",
-- "Ufficio", …) con un indirizzo di default. Bob le propone al passo città
-- e l'indirizzo entra nel messaggio al professionista.
-- Idempotente: create if not exists + drop-then-create per policy/indici.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'Casa',
  address_line text not null,
  city_slug text references public.cities (slug),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.customer_addresses enable row level security;

-- Un solo indirizzo di default per utente.
drop index if exists customer_addresses_one_default;
create unique index customer_addresses_one_default
  on public.customer_addresses (user_id)
  where is_default;

create index if not exists customer_addresses_user_idx
  on public.customer_addresses (user_id);

-- Solo il proprietario legge e gestisce i propri indirizzi.
drop policy if exists "Own addresses select" on public.customer_addresses;
create policy "Own addresses select" on public.customer_addresses
  for select using (user_id = (select auth.uid()));

drop policy if exists "Own addresses insert" on public.customer_addresses;
create policy "Own addresses insert" on public.customer_addresses
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "Own addresses update" on public.customer_addresses;
create policy "Own addresses update" on public.customer_addresses
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Own addresses delete" on public.customer_addresses;
create policy "Own addresses delete" on public.customer_addresses
  for delete using (user_id = (select auth.uid()));
