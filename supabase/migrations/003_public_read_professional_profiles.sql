-- BACKFILLED 2026-07-16: applied live on 2026-06-03, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

-- Consenti lettura pubblica del SOLO nome dei profili che appartengono a un professionista.
-- Il nome di un professionista è informazione pubblica della scheda; gli altri dati (telefono ecc.)
-- restano protetti perché questa policy si applica solo a chi è professionista.
drop policy if exists "Public reads professional profile names" on public.profiles;
create policy "Public reads professional profile names"
  on public.profiles
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.professionals pr
      where pr.user_id = profiles.user_id
    )
  );
