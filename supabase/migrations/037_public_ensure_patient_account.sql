-- ============================================================
-- 037_public_ensure_patient_account.sql
-- Crea-o-vincula la fila de patients al crear cuenta SIN haber
-- agendado antes. Solo authenticated (requiere sesión ya creada
-- vía signUp) — nunca se llama como anon.
-- ============================================================

create or replace function public.public_ensure_patient_account(
  p_tenant_id uuid, p_email text, p_full_name text, p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid;
begin
  if v_uid is null then
    raise exception 'public_ensure_patient_account: sin sesión';
  end if;

  if lower(p_email) is distinct from lower(auth.jwt() ->> 'email') then
    raise exception 'public_ensure_patient_account: email no coincide con la sesión';
  end if;

  insert into public.patients (tenant_id, full_name, email, phone, auth_user_id)
  values (p_tenant_id, p_full_name, lower(p_email), p_phone, v_uid)
  on conflict (tenant_id, email) do update
    set auth_user_id = coalesce(public.patients.auth_user_id, excluded.auth_user_id),
        full_name = coalesce(public.patients.full_name, excluded.full_name),
        phone = coalesce(public.patients.phone, excluded.phone)
  returning id into v_patient_id;

  return v_patient_id;
end;
$$;

grant execute on function public.public_ensure_patient_account(uuid, text, text, text) to authenticated;
