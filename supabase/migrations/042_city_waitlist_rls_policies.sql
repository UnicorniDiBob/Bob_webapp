-- 042_city_waitlist_rls_policies.sql
-- city_waitlist had RLS enabled but zero policies (Supabase advisor: rls_enabled_no_policy),
-- meaning signups were silently blocked. Adds: public insert (waitlist signup form,
-- no auth required) and admin/cs-only read.

drop policy if exists "city_waitlist_insert_public" on public.city_waitlist;
create policy "city_waitlist_insert_public"
  on public.city_waitlist
  for insert
  to public
  with check (true);

drop policy if exists "city_waitlist_admin_select" on public.city_waitlist;
create policy "city_waitlist_admin_select"
  on public.city_waitlist
  for select
  to public
  using (is_admin_or_cs());
