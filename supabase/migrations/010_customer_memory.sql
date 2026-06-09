-- [F2] Tabella memoria cliente
-- Salva le preferenze e lo storico di ricerca di ogni utente cliente.
-- Una sola riga per utente (upsert su user_id).

create table if not exists customer_memory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_service_slug  text,
  last_city_slug     text,
  last_budget_label  text,
  preferred_urgency  text check (preferred_urgency in ('alta', 'media', 'bassa')),
  search_count       integer not null default 1,
  updated_at         timestamptz not null default now(),
  constraint customer_memory_user_id_key unique (user_id)
);

alter table customer_memory enable row level security;

-- L'utente legge e aggiorna solo la propria riga
create policy "customer_memory_select_own"
  on customer_memory for select
  using (auth.uid() = user_id);

create policy "customer_memory_upsert_own"
  on customer_memory for insert
  with check (auth.uid() = user_id);

create policy "customer_memory_update_own"
  on customer_memory for update
  using (auth.uid() = user_id);
