-- 105_portfolio_free_una_foto.sql
--
-- IL LISTINO DEL 01/10 (decisione di Lucio). Le foto del portfolio:
--   Free     0 -> 1
--   Plus     1 -> illimitate
--   Business illimitate (invariato)
-- Il listino sta in src/lib/piani.ts e il limite lato client in
-- PORTFOLIO_LIMITS (src/lib/supabase/types.ts); questa e' la terza copia, ed
-- e' quella che conta: il trigger portfolio_limit_trigger (013) chiama
-- portfolio_limit() a ogni INSERT su portfolio_items.
--
-- RISCRITTA DA QUELLA VIVA. Il corpo di partenza e' pg_get_functiondef sulla
-- produzione del 01/10, non il file 013: cambia solo il CASE. Restano
-- IMMUTABLE e SET search_path = public (032). enforce_portfolio_limit non si
-- tocca: legge il limite da qui, e null significa gia' «illimitato».
--
-- LE FOTO GIA' CARICATE. Il trigger e' BEFORE INSERT: un limite piu' basso non
-- cancella niente, ferma solo le foto nuove. Qui i limiti salgono soltanto.
--
-- Idempotente: create or replace.

create or replace function public.portfolio_limit(tier text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case tier
    when 'free' then 1
    else null -- pro e business: illimitate
  end;
$$;
