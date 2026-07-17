-- 019: abilita Supabase Realtime su request_messages.
-- Perché: /messaggi ora sottoscrive gli INSERT via postgres_changes, così la
-- risposta della controparte compare nel thread aperto senza ricaricare.
-- Le RLS esistenti restano il filtro di sicurezza: realtime consegna solo
-- le righe che l'utente autenticato può già leggere via SELECT.
-- Idempotente: aggiunge la tabella alla publication solo se non c'è già.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'request_messages'
  ) then
    alter publication supabase_realtime add table public.request_messages;
  end if;
end $$;
