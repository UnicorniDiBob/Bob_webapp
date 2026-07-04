-- 012: Portfolio lavori (foto lavori conclusi) con limiti per tier.
-- Free = 0 foto, Pro = 5 foto, Business = illimitato + galleria in evidenza.

-- 1) Tier di abbonamento sul professionista
alter table public.professionals
  add column if not exists subscription_tier text not null default 'free'
  check (subscription_tier in ('free', 'pro', 'business'));

-- 2) Tabella portfolio
create table if not exists public.portfolio_items (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  title text not null,
  description text,
  image_url text not null,
  created_at timestamptz default now()
);

create index if not exists portfolio_items_professional_idx
  on public.portfolio_items (professional_id, created_at desc);

alter table public.portfolio_items enable row level security;

-- Lettura pubblica (le gallerie sono visibili a tutti i clienti)
create policy "portfolio_public_read" on public.portfolio_items
  for select using (true);

-- Solo il professionista proprietario può inserire/modificare/eliminare
create policy "portfolio_owner_insert" on public.portfolio_items
  for insert with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.user_id = auth.uid()
    )
  );

create policy "portfolio_owner_update" on public.portfolio_items
  for update using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.user_id = auth.uid()
    )
  );

create policy "portfolio_owner_delete" on public.portfolio_items
  for delete using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.user_id = auth.uid()
    )
  );

-- 3) Limiti per tier applicati lato database (fonte di verità)
create or replace function public.portfolio_limit(tier text)
returns integer
language sql immutable
as $$
  select case tier
    when 'free' then 0
    when 'pro' then 5
    else null -- business: illimitato
  end;
$$;

create or replace function public.enforce_portfolio_limit()
returns trigger
language plpgsql security definer
as $$
declare
  v_tier text;
  v_limit integer;
  v_count integer;
begin
  select subscription_tier into v_tier
  from public.professionals where id = new.professional_id;

  v_limit := public.portfolio_limit(v_tier);

  if v_limit is not null then
    select count(*) into v_count
    from public.portfolio_items
    where professional_id = new.professional_id;

    if v_count >= v_limit then
      raise exception 'portfolio_limit_reached: il piano % consente al massimo % foto', v_tier, v_limit
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists portfolio_limit_trigger on public.portfolio_items;
create trigger portfolio_limit_trigger
  before insert on public.portfolio_items
  for each row execute function public.enforce_portfolio_limit();

-- 4) Bucket storage pubblico per le foto
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

create policy "portfolio_storage_public_read" on storage.objects
  for select using (bucket_id = 'portfolio');

-- Upload solo nella propria cartella (nome cartella = auth.uid())
create policy "portfolio_storage_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'portfolio'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio_storage_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
