-- ============================================================
-- 038_link_patient_to_auth_user_guard.sql
-- Cierra el mismo hueco que 037: p_email no debe ser un dato que
-- el cliente elige libremente. Verificado contra auth.jwt() ->> 'email'.
-- Detectado por revisión de Claude Code al aplicar 037 — el riesgo
-- aquí era menor (la ruta actual llama tras verificar magic link),
-- pero nada en la firma de la función lo impedía a nivel BD.
-- ============================================================

create or replace function public.link_patient_to_auth_user(p_tenant_id uuid, p_email text)
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
    raise exception 'link_patient_to_auth_user: sin sesión';
  end if;

  if lower(p_email) is distinct from lower(auth.jwt() ->> 'email') then
    raise exception 'link_patient_to_auth_user: email no coincide con la sesión';
  end if;

  update public.patients p
     set auth_user_id = v_uid
   where p.tenant_id = p_tenant_id
     and p.email = lower(p_email)
     and (p.auth_user_id is null or p.auth_user_id = v_uid)
  returning p.id into v_patient_id;

  return v_patient_id;
end;
$$;
