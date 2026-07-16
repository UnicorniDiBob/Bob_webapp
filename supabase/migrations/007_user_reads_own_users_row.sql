-- BACKFILLED 2026-07-16: applied live on 2026-06-03, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

DROP POLICY IF EXISTS "User reads own row" ON public.users;
CREATE POLICY "User reads own row" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
