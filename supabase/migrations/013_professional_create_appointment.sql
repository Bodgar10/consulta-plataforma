-- ============================================================
-- 013_professional_create_appointment.sql
-- Sprint 2b · Cita manual (carril Opus).
-- La profesional agenda directo, sin Stripe, sin hold, sin cron. La cita nace
-- 'confirmed'. Calca el patrón de public_create_appointment (upsert de paciente
-- por (tenant,email) + chequeo de traslape a mano para mensaje limpio), pero:
--   created_by='professional', hold_expires_at=NULL, status='confirmed'.
-- Acepta paciente existente (p_patient_id) O datos de paciente nuevo (upsert).
-- Soporta recurrencias: p_recurrence_group_id opcional (lo setea el endpoint H1).
--
-- Doble defensa contra traslape (igual que producción):
--   1) exists() a mano -> mensaje 'El horario ya no está disponible' (UX).
--   2) EXCLUDE appointments_no_overlap -> backstop atómico ante carrera (23P01).
--
-- security definer: atomicidad + upsert + mensaje limpio (no por RLS; la
-- política appts_pro_all ya permitiría el insert directo).
-- NO crea sala Daily ni correo aquí: eso lo hace applyConfirmationEffects (app).
-- Devuelve { appointment_id, patient_id, transitioned }.
--   transitioned siempre true en creación (para que el endpoint dispare efectos
--   con el mismo patrón que la confirmación manual de Sprint 2).
-- Correr DESPUÉS de 001-005 y de las migraciones de Sprint 1/2.
-- ============================================================

create or replace function public.professional_create_appointment(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_patient_id uuid default null,
  p_full_name text default null,
  p_email text default null,
  p_phone text default null,
  p_payment_mode text default 'external',
  p_recurrence_group_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_patient_id uuid;
  v_appt_id uuid;
begin
  -- Tenant SIEMPRE desde la sesión, nunca del cliente.
  select tid into v_tenant_id
  from public.current_user_tenant_ids() as tid
  limit 1;

  if v_tenant_id is null then
    raise exception 'Sin tenant en la sesión';
  end if;

  if p_end_at <= p_start_at then
    raise exception 'El fin debe ser posterior al inicio';
  end if;

  if p_payment_mode not in ('single','credit','transfer','external') then
    raise exception 'payment_mode inválido';
  end if;

  -- Resolver paciente: existente (validado al tenant) o upsert de uno nuevo.
  if p_patient_id is not null then
    select id into v_patient_id
    from public.patients
    where id = p_patient_id and tenant_id = v_tenant_id;

    if v_patient_id is null then
      raise exception 'Paciente no encontrado en tu consulta';
    end if;
  else
    if p_full_name is null or p_email is null then
      raise exception 'Falta paciente: da p_patient_id o (p_full_name y p_email)';
    end if;

    insert into public.patients (tenant_id, full_name, email, phone)
    values (v_tenant_id, p_full_name, lower(p_email), p_phone)
    on conflict (tenant_id, email)
    do update set full_name = excluded.full_name,
                  phone = coalesce(excluded.phone, public.patients.phone)
    returning id into v_patient_id;
  end if;

  -- Capa 1: mensaje limpio de traslape antes del backstop del EXCLUDE.
  if exists (
    select 1 from public.appointments a
    where a.tenant_id = v_tenant_id
      and a.status in ('pending_payment','pending_verification','confirmed','completed')
      and a.start_at < p_end_at and a.end_at > p_start_at
  ) then
    raise exception 'El horario ya no está disponible' using errcode = '23P01';
  end if;

  -- Cita manual: confirmed directo, sin hold. Capa 2 (EXCLUDE) es el backstop.
  insert into public.appointments (
    tenant_id, patient_id, start_at, end_at, status,
    payment_mode, created_by, hold_expires_at, verified_by, verified_at,
    recurrence_group_id
  )
  values (
    v_tenant_id, v_patient_id, p_start_at, p_end_at, 'confirmed',
    p_payment_mode, 'professional', null, auth.uid(), now(),
    p_recurrence_group_id
  )
  returning id into v_appt_id;

  return jsonb_build_object(
    'appointment_id', v_appt_id,
    'patient_id', v_patient_id,
    'transitioned', true
  );
end;
$$;

grant execute on function public.professional_create_appointment(
  timestamptz, timestamptz, uuid, text, text, text, text, uuid
) to authenticated;
