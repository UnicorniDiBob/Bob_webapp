-- BACKFILLED 2026-07-16: applied live on 2026-06-03, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

ALTER TABLE public.request_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_request_messages_read_at ON public.request_messages (request_id, read_at);

-- Il cliente può segnare come letti i messaggi delle proprie richieste
DROP POLICY IF EXISTS "User marks own request_messages read" ON public.request_messages;
CREATE POLICY "User marks own request_messages read" ON public.request_messages
  FOR UPDATE TO authenticated
  USING (request_id IN (SELECT id FROM public.requests WHERE customer_id = auth.uid()))
  WITH CHECK (request_id IN (SELECT id FROM public.requests WHERE customer_id = auth.uid()));

-- Il professionista può segnare come letti i messaggi delle richieste a lui assegnate
DROP POLICY IF EXISTS "Pro marks assigned request_messages read" ON public.request_messages;
CREATE POLICY "Pro marks assigned request_messages read" ON public.request_messages
  FOR UPDATE TO authenticated
  USING (request_id IN (SELECT public.my_assigned_request_ids()))
  WITH CHECK (request_id IN (SELECT public.my_assigned_request_ids()));
