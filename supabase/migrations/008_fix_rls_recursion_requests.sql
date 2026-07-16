-- BACKFILLED 2026-07-16: applied live on 2026-06-03, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

-- Helper SECURITY DEFINER per evitare la ricorsione tra requests e request_professionals
CREATE OR REPLACE FUNCTION public.my_assigned_request_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  select rp.request_id
  from public.request_professionals rp
  where rp.professional_id in (select id from public.professionals where user_id = auth.uid());
$$;

-- Riscrivo la policy su requests per usare la funzione (niente sottoquery su request_professionals)
DROP POLICY IF EXISTS "Pro reads assigned requests" ON public.requests;
CREATE POLICY "Pro reads assigned requests" ON public.requests
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.my_assigned_request_ids()));
