-- BACKFILLED 2026-07-16: applied live on 2026-06-03, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check check (status = any (array['draft'::text, 'sent'::text, 'quote_request'::text, 'matched'::text, 'closed'::text]));

alter table public.request_professionals drop constraint if exists request_professionals_status_check;
alter table public.request_professionals add constraint request_professionals_status_check check (status = any (array['suggested'::text, 'contacted'::text, 'quote_requested'::text, 'quoted'::text, 'responded'::text, 'declined'::text]));
