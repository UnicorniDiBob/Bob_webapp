-- 127 — nei bucket delle immagini scrive solo il service role (16/10/2026).
--
-- Da #183/#184 ogni immagine entra nello storage da /api/upload/immagine, che
-- toglie GPS e metadati e scrive col service role; /api/bob/chat fa lo stesso
-- su brief-photos. Nessun componente chiama piu' storage.upload(). Ma finche'
-- le policy di INSERT restano, un client con una sessione normale puo'
-- ancora caricare il file grezzo direttamente, saltando il server: la regola
-- era nel codice. Da qui e' nel database.
--
-- POLICY SOSTITUITE (tolte, senza ricrearle: per la scrittura l'assenza della
-- policy E' la regola — service_role ha BYPASSRLS, authenticated e anon no,
-- verificato in produzione il 16/10):
--   * "portfolio_storage_owner_insert"   (013)  INSERT, bucket portfolio,
--                                               nella propria cartella
--   * "Pro uploads verification docs"    (052)  INSERT to authenticated,
--                                               bucket verifica-documenti
--   brief-photos non ha mai avuto policy: ci scrive solo il service role (022).
--   Policy di UPDATE su questi bucket: nessuna, ne' prima ne' dopo.
--
-- NON TOCCATE, di proposito:
--   * "portfolio_storage_public_read"    (013)  SELECT pubblica di portfolio
--   * "Pro reads own verification docs"  (052)  SELECT del proprietario
--   * "Staff reads verification docs"    (052)  SELECT di admin/cs
--   * "portfolio_storage_owner_delete"   (013)  DELETE nella propria cartella:
--     e' il rollback di ProPortfolio quando l'insert in portfolio_items
--     fallisce (PR #184), e la cancellazione di una foto dal portfolio.
--   La 044 (divulgazione progressiva dell'indirizzo) ha policy sulle TABELLE,
--   non su storage.objects: questa migrazione non la puo' toccare.
--
-- Idempotente: drop if exists, poi una guardia che FALLISCE se dopo i drop
-- resta una qualunque policy di scrittura (INSERT, UPDATE o ALL) che possa
-- toccare uno dei tre bucket — anche una senza filtro sul bucket, che varrebbe
-- per tutti. Rigiocata su un database dove le policy non ci sono piu', non fa
-- niente e passa.

begin;

drop policy if exists "portfolio_storage_owner_insert" on storage.objects;
drop policy if exists "Pro uploads verification docs" on storage.objects;

do $$
declare
  r record;
  testo text;
begin
  for r in
    select pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) as q,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as c
    from pg_policy pol
    where pol.polrelid = 'storage.objects'::regclass
      and pol.polcmd in ('a', 'w', '*')   -- INSERT, UPDATE, ALL
  loop
    testo := coalesce(r.q, '') || ' ' || coalesce(r.c, '');
    if testo ~ '(portfolio|verifica-documenti|brief-photos)' or testo !~ 'bucket_id' then
      raise exception
        '127: resta una policy di scrittura su storage.objects che puo'' toccare i bucket immagini: "%" (polcmd %)',
        r.polname, r.polcmd;
    end if;
  end loop;
end $$;

commit;
