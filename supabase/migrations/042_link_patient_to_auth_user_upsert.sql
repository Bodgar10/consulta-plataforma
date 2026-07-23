-- ============================================================
-- 042_link_patient_to_auth_user_upsert.sql
-- Extiende link_patient_to_auth_user: además de LIGAR una fila de
-- paciente existente (caso: agendó anónimo y luego se registra),
-- CREA la fila si no existía (caso: se registra sin haber agendado).
--
-- INCLUYE la guarda de email de 038 (p_email debe coincidir con el
-- correo de la sesión), que se detectó AUSENTE en el remoto: 038
-- nunca se aplicó en producción, así que este archivo también cierra
-- ese hueco de seguridad activo, no solo agrega el camino de INSERT.
--
-- Misma firma (p_tenant_id uuid, p_email text) — sin cambio de aridad,
-- no requiere drop. SECURITY DEFINER + search_path='' => auth.users
-- va totalmente calificado.
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
  v_meta_name text;
begin
  if v_uid is null then
    raise exception 'link_patient_to_auth_user: sin sesión';
  end if;

  -- Guarda de 038: p_email debe coincidir con el correo de la sesión.
  if lower(p_email) is distinct from lower(auth.jwt() ->> 'email') then
    raise exception 'link_patient_to_auth_user: email no coincide con la sesión';
  end if;

  -- 1) Camino común: ya existe una fila de paciente (agendó anónimo antes) -> ligarla.
  update public.patients p
     set auth_user_id = v_uid
   where p.tenant_id = p_tenant_id
     and p.email = lower(p_email)
     and (p.auth_user_id is null or p.auth_user_id = v_uid)
  returning p.id into v_patient_id;

  if v_patient_id is not null then
    return v_patient_id;
  end if;

  -- 2) No había fila que ligar: crear el paciente. full_name sale del
  -- raw_user_meta_data del propio usuario (auth.users, calificado por el
  -- search_path bloqueado); nunca null (columna NOT NULL) -> fallback al email.
  select nullif(u.raw_user_meta_data ->> 'full_name', '')
    into v_meta_name
    from auth.users u
   where u.id = v_uid;

  insert into public.patients (tenant_id, email, auth_user_id, full_name)
  values (p_tenant_id, lower(p_email), v_uid, coalesce(v_meta_name, p_email))
  on conflict (tenant_id, email) do nothing
  returning id into v_patient_id;

  -- Si hubo conflicto (existe fila de ese correo pero de OTRO uid), no la
  -- secuestramos: devolvemos null, igual que el comportamiento de privacidad
  -- del UPDATE. El caller ya trata null como "sin cuenta que vincular".
  return v_patient_id;
end;
$$;
