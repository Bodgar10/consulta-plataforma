-- ============================================================
-- 018_patient_magic_link.sql
-- Soporte server-side del magic link del paciente (login sin contraseña).
-- Camino elegido: Supabase Auth nativo (signInWithOtp) + vinculación por (tenant,email).
-- Estas funciones NO crean sesión (eso lo hace Supabase Auth); solo dan el lookup
-- de existencia (privacidad) y la vinculación idempotente para el callback.
-- ============================================================

-- ¿Existe un paciente para (tenant, email)? Definer: el anon no lee patients.
-- Se usa server-side (service/backend) para decidir si disparar el OTP,
-- sin revelar el resultado al cliente (A2 responde 202 pase lo que pase).
create or replace function public.patient_exists_for_login(
  p_tenant_id uuid,
  p_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patients
    where tenant_id = p_tenant_id and email = lower(p_email)
  )
$$;

-- Vinculación idempotente: liga la fila de paciente (tenant,email) al auth user
-- que acaba de iniciar sesión por magic link. Se invoca en el callback (A3) ya
-- bajo sesión authenticated del propio usuario. Idempotente: re-ligar = mismo estado.
-- No pisa un auth_user_id ya puesto que pertenezca a OTRO usuario (guard anti-secuestro).
create or replace function public.link_patient_to_auth_user(
  p_tenant_id uuid,
  p_email text
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
    raise exception 'link_patient_to_auth_user: sin sesión';
  end if;

  update public.patients p
     set auth_user_id = v_uid
   where p.tenant_id = p_tenant_id
     and p.email = lower(p_email)
     and (p.auth_user_id is null or p.auth_user_id = v_uid)  -- no secuestrar otra cuenta
  returning p.id into v_patient_id;

  -- Si no ligó (no existe paciente, o la fila ya pertenece a otro uid), devolvemos null:
  -- el callback trata null como "sin cuenta que vincular" y redirige igual (privacidad).
  return v_patient_id;
end;
$$;

-- El lookup de existencia lo llama el backend con service role (o desde una route
-- server-side); NO se expone a anon. La vinculación la llama el usuario autenticado.
revoke all on function public.patient_exists_for_login(uuid, text) from public, anon, authenticated;
grant execute on function public.patient_exists_for_login(uuid, text) to service_role;

revoke all on function public.link_patient_to_auth_user(uuid, text) from public, anon;
grant execute on function public.link_patient_to_auth_user(uuid, text) to authenticated;
