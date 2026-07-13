-- ============================================================
-- 028_event_registration_auth_link.sql
-- Z2: liga auth_user_id en live_event_registrations.
--  (a) link_event_registrations_to_auth_user: puente retroactivo por email,
--      espejo de link_patient_to_auth_user (018). Se llama en el login/magic-link.
--  (b) public_register_live_event_as_user: variante del registro que acepta
--      auth_user_id, para ligar en el momento si hay sesión.
-- Depende de 005 (live_event_registrations) y 018 (patrón de vínculo).
-- ============================================================

-- (a) Puente retroactivo: liga por (tenant, email) los registros anónimos.
create or replace function public.link_event_registrations_to_auth_user(
  p_tenant_id uuid,
  p_email text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_count integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'no hay sesión';
  end if;

  update public.live_event_registrations
    set auth_user_id = v_uid
    where tenant_id = p_tenant_id
      and lower(email) = lower(p_email)
      and auth_user_id is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.link_event_registrations_to_auth_user(uuid, text) to authenticated;

-- (b) Registro que liga en el momento (si el route detecta sesión). Reusa el
-- control de cupo llamando internamente a la lógica existente y luego liga.
create or replace function public.public_register_live_event_as_user(
  p_tenant_id uuid,
  p_event_id uuid,
  p_email text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_reg_id uuid;
begin
  v_uid := auth.uid();
  -- Reusa la función de registro con control de cupo (FOR UPDATE) ya existente.
  v_reg_id := public.public_register_live_event(p_tenant_id, p_event_id, p_email, p_name);

  if v_uid is not null then
    update public.live_event_registrations
      set auth_user_id = v_uid
      where id = v_reg_id and auth_user_id is null;
  end if;

  return v_reg_id;
end;
$$;

grant execute on function public.public_register_live_event_as_user(uuid, uuid, text, text) to authenticated;
