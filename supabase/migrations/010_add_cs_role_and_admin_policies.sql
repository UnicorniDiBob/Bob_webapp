-- BACKFILLED 2026-07-16: applied live on 2026-06-27, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

-- 1. Add 'cs' to the users role check constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['customer'::text, 'professional'::text, 'admin'::text, 'cs'::text]));

-- 2. Helper functions used in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin_or_cs()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'cs')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 3. Admin/CS can read and update professionals
CREATE POLICY "admin_cs_select_professionals"
  ON public.professionals FOR SELECT
  USING (is_admin_or_cs());

CREATE POLICY "admin_cs_update_professionals"
  ON public.professionals FOR UPDATE
  USING (is_admin_or_cs());

-- 4. Admin/CS can read and update profiles
CREATE POLICY "admin_cs_select_profiles"
  ON public.profiles FOR SELECT
  USING (is_admin_or_cs());

CREATE POLICY "admin_cs_update_profiles"
  ON public.profiles FOR UPDATE
  USING (is_admin_or_cs());

-- 5. Admin/CS can read and update users
CREATE POLICY "admin_cs_select_users"
  ON public.users FOR SELECT
  USING (is_admin_or_cs());

CREATE POLICY "admin_cs_update_users"
  ON public.users FOR UPDATE
  USING (is_admin_or_cs());

-- 6. Admin/CS can read and update requests
CREATE POLICY "admin_cs_select_requests"
  ON public.requests FOR SELECT
  USING (is_admin_or_cs());

CREATE POLICY "admin_cs_update_requests"
  ON public.requests FOR UPDATE
  USING (is_admin_or_cs());

-- 7. Admin/CS can read messages
CREATE POLICY "admin_cs_select_messages"
  ON public.request_messages FOR SELECT
  USING (is_admin_or_cs());

-- 8. Admin/CS can read professional_services
CREATE POLICY "admin_cs_select_pro_services"
  ON public.professional_services FOR SELECT
  USING (is_admin_or_cs());

-- 9. Admin can insert into users (to create CS accounts)
CREATE POLICY "admin_insert_users"
  ON public.users FOR INSERT
  WITH CHECK (is_admin());
