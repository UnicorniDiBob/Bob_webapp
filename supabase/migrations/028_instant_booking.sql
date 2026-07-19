-- 028_instant_booking.sql
-- Instant Booking — Phase 0 groundwork. See docs/Bob_Instant_Booking_Spec.md
-- Additive only; NO customer-facing booking surface ships with this migration.
-- instant_book_enabled is a "prepared" flag until the payments/booking flow lands.
-- Idempotent: safe to re-run.

begin;

-- 1. Catalog layer (admin-curated) — subservices ------------------------------
alter table public.subservices
  add column if not exists instant_book_eligible boolean not null default false;

alter table public.subservices
  add column if not exists booking_fields jsonb not null default '[]'::jsonb;

alter table public.subservices
  add column if not exists default_rate_unit text
    check (default_rate_unit is null or default_rate_unit in ('hour','m2','job','session'));

-- 2. Pro offering — professional_services ------------------------------------
alter table public.professional_services
  add column if not exists instant_book_enabled boolean not null default false;

alter table public.professional_services
  add column if not exists rate_amount numeric
    check (rate_amount is null or rate_amount >= 0);

alter table public.professional_services
  add column if not exists rate_unit text
    check (rate_unit is null or rate_unit in ('hour','m2','job','session'));

alter table public.professional_services
  add column if not exists min_units numeric
    check (min_units is null or min_units > 0);

alter table public.professional_services
  add column if not exists slot_duration_min integer
    check (slot_duration_min is null or slot_duration_min > 0);

alter table public.professional_services
  add column if not exists cancellation_window_hours integer
    check (cancellation_window_hours is null or cancellation_window_hours >= 0);

-- rate_unit must equal the subservice's billable field unit: enforced in-app.

-- 3. Availability -------------------------------------------------------------
create table if not exists public.professional_availability (
  id uuid primary key default extensions.uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists idx_prof_availability_pro
  on public.professional_availability(professional_id);

create table if not exists public.professional_availability_blocks (
  id uuid primary key default extensions.uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_prof_avail_blocks_pro
  on public.professional_availability_blocks(professional_id);

-- 4. Appointments additions (reuse existing table for bookings) ---------------
alter table public.appointments
  add column if not exists customer_id uuid references public.users(id) on delete set null;

alter table public.appointments
  add column if not exists professional_service_id uuid
    references public.professional_services(id) on delete set null;

alter table public.appointments
  add column if not exists booking_answers jsonb not null default '{}'::jsonb;

alter table public.appointments
  add column if not exists source text not null default 'pro'
    check (source in ('pro','direct'));

-- 5. Enablement gate: Layer-1 eligibility + completeness + cancellation min ---
create or replace function public.enforce_instant_book_enable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_eligible boolean;
  v_min_cancel_hours constant integer := 24;
begin
  if new.instant_book_enabled is true then
    if new.subservice_id is null then
      raise exception 'instant_book requires a subservice_id';
    end if;

    select instant_book_eligible into v_eligible
      from public.subservices where id = new.subservice_id;

    if coalesce(v_eligible, false) = false then
      raise exception 'subservice % is not instant_book_eligible', new.subservice_id;
    end if;

    if new.rate_amount is null
       or new.rate_unit is null
       or new.min_units is null
       or new.slot_duration_min is null then
      raise exception 'instant_book requires rate_amount, rate_unit, min_units, slot_duration_min';
    end if;

    if new.cancellation_window_hours is null
       or new.cancellation_window_hours < v_min_cancel_hours then
      raise exception 'cancellation_window_hours must be >= % hours', v_min_cancel_hours;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_instant_book_enable on public.professional_services;
create trigger trg_enforce_instant_book_enable
  before insert or update on public.professional_services
  for each row execute function public.enforce_instant_book_enable();

-- Tier gating (subscription_tier in pro/business) is enforced at the read/
-- booking-surface layer, not here: a later downgrade on professionals would
-- not re-fire this row trigger, so the public flow must re-check tier at query time.

-- 6. RLS ----------------------------------------------------------------------
alter table public.professional_availability enable row level security;
alter table public.professional_availability_blocks enable row level security;

drop policy if exists prof_availability_select on public.professional_availability;
create policy prof_availability_select on public.professional_availability
  for select using (true);

drop policy if exists prof_availability_write on public.professional_availability;
create policy prof_availability_write on public.professional_availability
  for all
  using (professional_id in (select id from public.professionals where user_id = auth.uid()))
  with check (professional_id in (select id from public.professionals where user_id = auth.uid()));

drop policy if exists prof_avail_blocks_select on public.professional_availability_blocks;
create policy prof_avail_blocks_select on public.professional_availability_blocks
  for select using (true);

drop policy if exists prof_avail_blocks_write on public.professional_availability_blocks;
create policy prof_avail_blocks_write on public.professional_availability_blocks
  for all
  using (professional_id in (select id from public.professionals where user_id = auth.uid()))
  with check (professional_id in (select id from public.professionals where user_id = auth.uid()));

drop policy if exists appointments_customer_select on public.appointments;
create policy appointments_customer_select on public.appointments
  for select using (customer_id = auth.uid());

commit;
