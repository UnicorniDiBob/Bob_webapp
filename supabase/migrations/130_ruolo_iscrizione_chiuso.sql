-- 130 — Il ruolo non si sceglie da soli.
--
-- Falla (verificata sulla produzione il 17/10/2026): handle_new_user copiava in
-- public.users.role il valore di raw_user_meta_data->>'role' senza filtrarlo, e
-- users_role_check ammette 'admin' e 'cs'. Chiunque si iscrivesse con la chiave
-- pubblica passando data: { role: "admin" } diventava admin. In più la policy
-- admin_cs_update_users lasciava a un cs aggiornare anche users.role, quindi
-- promuoversi admin da solo.
--
-- 1. handle_new_user: dal metadata si accettano solo 'customer' e 'professional';
--    qualunque altro valore diventa 'customer'. Corpo riscritto dalla definizione
--    VIVA (pg_get_functiondef sulla produzione), non dai file precedenti: l'unica
--    riga cambiata è l'espressione del ruolo. Gli account staff li crea solo
--    /api/admin/staff (o /api/admin/cs) col service role, con un update esplicito.
--
-- 2. guard_users_role: trigger BEFORE UPDATE su public.users. Se role cambia e chi
--    chiama è anon/authenticated, deve essere admin. Il service role e le
--    connessioni dirette (postgres, GoTrue) passano. SECURITY INVOKER di
--    proposito: con DEFINER current_user sarebbe il proprietario e il controllo
--    non vedrebbe chi chiama.
--
-- Idempotente: create or replace per le funzioni, drop-then-create per il trigger.

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_first text := nullif(new.raw_user_meta_data->>'first_name', '');
  v_last  text := nullif(new.raw_user_meta_data->>'last_name', '');
  v_full  text := nullif(new.raw_user_meta_data->>'full_name', '');
begin
  insert into public.users (id, role)
  values (
    new.id,
    case
      when new.raw_user_meta_data->>'role' in ('customer', 'professional')
        then new.raw_user_meta_data->>'role'
      else 'customer'
    end
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id, first_name, last_name, full_name)
  values (
    new.id,
    v_first,
    v_last,
    coalesce(nullif(trim(coalesce(v_first, '') || ' ' || coalesce(v_last, '')), ''), v_full)
  )
  on conflict (user_id) do nothing;

  insert into public.profile_private (user_id, date_of_birth, terms_accepted_at, terms_version)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    case
      when nullif(new.raw_user_meta_data->>'terms_accepted_at', '') is not null
        then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      else null
    end,
    nullif(new.raw_user_meta_data->>'terms_version', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

create or replace function public.guard_users_role()
 returns trigger
 language plpgsql
 security invoker
 set search_path to ''
as $function$
begin
  if new.role is distinct from old.role
     and (current_user in ('anon', 'authenticated')
          or coalesce(auth.role(), '') in ('anon', 'authenticated'))
     and not private.is_admin()
  then
    raise exception 'Solo un admin può cambiare il ruolo di un account'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_users_role() from public, anon, authenticated;

drop trigger if exists trg_guard_users_role on public.users;
create trigger trg_guard_users_role
  before update on public.users
  for each row execute function public.guard_users_role();
