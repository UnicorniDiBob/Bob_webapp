-- 043: quante volte abbiamo già riprovato, e quando.
--
-- Il ritentativo notturno (10.5) oggi ripesca ogni notte tutti i casi rimasti
-- senza risposta dal VIES. Se un caso non si sblocca — perché il numero è di
-- un soggetto che il VIES non conosce, e non perché il servizio era giù — quel
-- caso verrebbe interrogato ogni notte per sempre: traffico inutile verso un
-- servizio pubblico gratuito, e nessuna informazione nuova.
--
-- Con queste due colonne il lavoro notturno sa cosa ha già fatto:
--   * salta chi ha già esaurito i tentativi (resta alla coda umana, che è la
--     sede giusta per un caso che la macchina non sa chiudere);
--   * salta chi ha già riprovato nelle ultime ore, così un secondo giro dello
--     stesso cron non raddoppia le chiamate.
--
-- Idempotente.

alter table public.professional_verification
  add column if not exists vat_retry_count integer not null default 0,
  add column if not exists vat_last_retry_at timestamptz;

comment on column public.professional_verification.vat_retry_count is
  'Quanti ritentativi automatici sono già stati fatti su questa richiesta. Oltre il limite previsto dal cron il caso resta alla decisione umana.';
comment on column public.professional_verification.vat_last_retry_at is
  'Quando è avvenuto l''ultimo ritentativo automatico: evita di ripetere lo stesso controllo due volte nella stessa notte.';

-- Il cron cerca esattamente questo insieme: in attesa, senza esito, con
-- tentativi ancora disponibili. Indice parziale così la ricerca notturna resta
-- istantanea anche con molte righe verificate.
create index if not exists professional_verification_retry_idx
  on public.professional_verification (vat_retry_count, vat_last_retry_at)
  where vat_review_state = 'pending' and vat_check_source is null;
