-- 050: tentativo di bloccare la lettura di profiles.phone da anon.
--
-- VERIFICATO INEFFICACE il 14/08, subito dopo l'applicazione — non
-- rimosso dalla storia per non ricreare la stessa deriva raccontata in
-- M1 (nomi applicati in produzione senza un file nel repo). Il motivo:
-- anon e authenticated hanno comunque il GRANT SELECT sull'intera
-- tabella profiles (default Supabase), e Postgres controlla prima il
-- privilegio di tabella — un revoke sulla singola colonna non toglie
-- nulla finché resta il grant più ampio sopra. Il rimedio vero è nella
-- 051 (tabella profile_phone con RLS propria). Questa riga resta
-- innocua e idempotente: un revoke su un privilegio già assente non è
-- un errore in Postgres.

revoke select (phone) on public.profiles from anon;
