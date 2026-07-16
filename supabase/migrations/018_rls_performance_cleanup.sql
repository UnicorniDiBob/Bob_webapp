-- Performance cleanup, prompted by Supabase advisor warnings (auth_rls_initplan,
-- duplicate_index). No behavior change: every policy below keeps the exact same
-- access logic, just wraps auth.uid() as (select auth.uid()) so Postgres evaluates
-- it once per query instead of re-evaluating it for every row. Safe to re-run.

-- 1. Drop the duplicate unique index on professionals.user_id.
-- professionals_user_id_key backs the actual UNIQUE(user_id) constraint from the
-- original schema; professionals_one_per_user is a redundant standalone index
-- added later that does the same thing.
drop index if exists public.professionals_one_per_user;

-- 2. profiles
drop policy if exists "User reads own profile" on public.profiles;
create policy "User reads own profile" on public.profiles
  for select using (user_id = (select auth.uid()));

drop policy if exists "User updates own profile" on public.profiles;
create policy "User updates own profile" on public.profiles
  for update using (user_id = (select auth.uid()));

drop policy if exists "User inserts own profile" on public.profiles;
create policy "User inserts own profile" on public.profiles
  for insert with check (user_id = (select auth.uid()));

-- 3. requests
drop policy if exists "User reads own requests" on public.requests;
create policy "User reads own requests" on public.requests
  for select using (customer_id = (select auth.uid()));

drop policy if exists "User inserts own requests" on public.requests;
create policy "User inserts own requests" on public.requests
  for insert with check (customer_id = (select auth.uid()));

drop policy if exists "User updates own requests" on public.requests;
create policy "User updates own requests" on public.requests
  for update using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));

-- 4. request_messages
drop policy if exists "User reads own request_messages" on public.request_messages;
create policy "User reads own request_messages" on public.request_messages
  for select using (
    request_id in (select id from public.requests where customer_id = (select auth.uid()))
  );

drop policy if exists "User inserts own request_messages" on public.request_messages;
create policy "User inserts own request_messages" on public.request_messages
  for insert with check (
    request_id in (select id from public.requests where customer_id = (select auth.uid()))
  );

drop policy if exists "Pro inserts assigned messages" on public.request_messages;
create policy "Pro inserts assigned messages" on public.request_messages
  for insert with check (
    sender_id = (select auth.uid())
    and request_id in (
      select request_id from public.request_professionals
      where professional_id in (select public.my_professional_ids())
    )
  );

drop policy if exists "User marks own request_messages read" on public.request_messages;
create policy "User marks own request_messages read" on public.request_messages
  for update to authenticated
  using (request_id in (select id from public.requests where customer_id = (select auth.uid())))
  with check (request_id in (select id from public.requests where customer_id = (select auth.uid())));

-- 5. request_professionals
drop policy if exists "User reads own request_professionals" on public.request_professionals;
create policy "User reads own request_professionals" on public.request_professionals
  for select using (
    request_id in (select id from public.requests where customer_id = (select auth.uid()))
  );

drop policy if exists "User inserts own request_professionals" on public.request_professionals;
create policy "User inserts own request_professionals" on public.request_professionals
  for insert with check (
    request_id in (select id from public.requests where customer_id = (select auth.uid()))
  );

-- 6. customer_memory
drop policy if exists "customer_memory_select_own" on public.customer_memory;
create policy "customer_memory_select_own" on public.customer_memory
  for select using ((select auth.uid()) = user_id);

drop policy if exists "customer_memory_update_own" on public.customer_memory;
create policy "customer_memory_update_own" on public.customer_memory
  for update using ((select auth.uid()) = user_id);

drop policy if exists "customer_memory_upsert_own" on public.customer_memory;
create policy "customer_memory_upsert_own" on public.customer_memory
  for insert with check ((select auth.uid()) = user_id);

-- 7. appointments
drop policy if exists "Pro reads own appointments" on public.appointments;
create policy "Pro reads own appointments" on public.appointments
  for select using (
    professional_id in (select id from public.professionals where user_id = (select auth.uid()))
  );

drop policy if exists "Pro inserts own appointments" on public.appointments;
create policy "Pro inserts own appointments" on public.appointments
  for insert with check (
    professional_id in (select id from public.professionals where user_id = (select auth.uid()))
  );

drop policy if exists "Pro updates own appointments" on public.appointments;
create policy "Pro updates own appointments" on public.appointments
  for update using (
    professional_id in (select id from public.professionals where user_id = (select auth.uid()))
  ) with check (
    professional_id in (select id from public.professionals where user_id = (select auth.uid()))
  );

drop policy if exists "Pro deletes own appointments" on public.appointments;
create policy "Pro deletes own appointments" on public.appointments
  for delete using (
    professional_id in (select id from public.professionals where user_id = (select auth.uid()))
  );

-- 8. users
drop policy if exists "User reads own row" on public.users;
create policy "User reads own row" on public.users
  for select to authenticated using (id = (select auth.uid()));

-- 9. portfolio_items
drop policy if exists "portfolio_owner_insert" on public.portfolio_items;
create policy "portfolio_owner_insert" on public.portfolio_items
  for insert with check (
    exists (select 1 from public.professionals p where p.id = portfolio_items.professional_id and p.user_id = (select auth.uid()))
  );

drop policy if exists "portfolio_owner_update" on public.portfolio_items;
create policy "portfolio_owner_update" on public.portfolio_items
  for update using (
    exists (select 1 from public.professionals p where p.id = portfolio_items.professional_id and p.user_id = (select auth.uid()))
  );

drop policy if exists "portfolio_owner_delete" on public.portfolio_items;
create policy "portfolio_owner_delete" on public.portfolio_items
  for delete using (
    exists (select 1 from public.professionals p where p.id = portfolio_items.professional_id and p.user_id = (select auth.uid()))
  );

-- 10. professionals
drop policy if exists "Pro creates own profile" on public.professionals;
create policy "Pro creates own profile" on public.professionals
  for insert with check (
    user_id = (select auth.uid())
    and verification_status = 'unverified'
    and subscription_tier = 'free'
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'professional')
  );

drop policy if exists "Pro updates own profile" on public.professionals;
create policy "Pro updates own profile" on public.professionals
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 11. job_briefs
drop policy if exists "job_briefs_own_read" on public.job_briefs;
create policy "job_briefs_own_read" on public.job_briefs
  for select using ((select auth.uid()) = user_id);

-- 12. ratings
drop policy if exists "Customer inserts review for closed request" on public.ratings;
create policy "Customer inserts review for closed request" on public.ratings
  for insert with check (
    customer_id = (select auth.uid())
    and request_id is not null
    and exists (
      select 1 from public.requests r
      where r.id = ratings.request_id
        and r.customer_id = (select auth.uid())
        and r.status = 'closed'
    )
    and exists (
      select 1 from public.request_professionals rp
      where rp.request_id = ratings.request_id
        and rp.professional_id = ratings.professional_id
    )
  );
