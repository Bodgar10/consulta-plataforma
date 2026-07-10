-- ============================================================
-- 019_booking_leadtime_horizon.sql
-- Cierra QA-D05: valida booking_settings (lead_time_hours, max_horizon_days) y "no en el pasado"
-- en el servidor, antes de crear el hold. Comparaciones de instante: zona-agnósticas, sin offset.
-- Cuerpo tomado verbatim del remoto (idéntico a 002/003); solo se AÑADE el bloque de guarda.
-- ============================================================

create or replace function public.public_create_appointment(
  p_tenant_id uuid,
  p_start_at timestamp with time zone,
  p_end_at timestamp with time zone,
  p_full_name text,
  p_email text,
  p_phone text,
  p_payment_mode text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_patient_id uuid;
  v_appt_id uuid;
  v_status text;
  v_settings jsonb;
  v_lead_hours int;
  v_horizon_days int;
begin
  if p_payment_mode not in ('single','transfer') then
    raise exception 'payment_mode inválido para booking público';
  end if;

  -- ===== Guarda de tiempo (lead-time + horizonte + no-pasado), server-side =====
  select booking_settings into v_settings
  from public.tenants where id = p_tenant_id and status = 'active';
  if v_settings is null then
    raise exception 'Tenant no disponible';
  end if;
  v_lead_hours   := coalesce((v_settings->>'lead_time_hours')::int, 12);
  v_horizon_days := coalesce((v_settings->>'max_horizon_days')::int, 60);

  if p_start_at <= now() then
    raise exception 'No se puede reservar en el pasado';
  end if;
  if p_start_at < now() + make_interval(hours => v_lead_hours) then
    raise exception 'La cita requiere al menos % horas de anticipación', v_lead_hours;
  end if;
  if p_start_at > now() + make_interval(days => v_horizon_days) then
    raise exception 'La cita está fuera del horizonte de % días', v_horizon_days;
  end if;
  -- ===== fin guarda =====

  -- Guard de concurrencia: no permitir traslape con cita viva.
  if exists (
    select 1 from public.appointments a
    where a.tenant_id = p_tenant_id
      and a.status in ('pending_payment','pending_verification','confirmed','completed')
      and a.start_at < p_end_at and a.end_at > p_start_at
  ) then
    raise exception 'El horario ya no está disponible';
  end if;

  -- Upsert de paciente por (tenant, email), sin auth_user_id (anónimo).
  insert into public.patients (tenant_id, full_name, email, phone)
  values (p_tenant_id, p_full_name, lower(p_email), p_phone)
  on conflict (tenant_id, email)
  do update set full_name = excluded.full_name,
                phone = coalesce(excluded.phone, public.patients.phone)
  returning id into v_patient_id;

  v_status := case when p_payment_mode = 'transfer'
                   then 'pending_verification' else 'pending_payment' end;

  insert into public.appointments (
    tenant_id, patient_id, start_at, end_at, status,
    payment_mode, created_by, hold_expires_at
  )
  values (
    p_tenant_id, v_patient_id, p_start_at, p_end_at, v_status,
    p_payment_mode, 'patient', now() + interval '24 hours'
  )
  returning id into v_appt_id;

  return v_appt_id;
end;
$function$;

grant execute on function public.public_create_appointment(uuid, timestamp with time zone, timestamp with time zone, text, text, text, text)
  to anon, authenticated;
