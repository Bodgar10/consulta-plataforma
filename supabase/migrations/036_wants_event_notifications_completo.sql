-- ============================================================
-- 036_wants_event_notifications_completo.sql
-- Consolida 033-036: checkbox de consentimiento para anuncios de
-- talleres/cursos en los 4 puntos de captura de correo (booking,
-- inscripción a evento, captura de lead), más la función pública
-- de baja sin requerir login. Ya aplicado en remoto vía SQL Editor
-- en pasos separados; este archivo lo deja versionado completo.
--
-- IMPORTANTE: cada create or replace de función con parámetro nuevo
-- va precedido de un drop de la firma vieja, porque Postgres trata
-- una firma con más parámetros como una función DISTINTA (overload),
-- no como un reemplazo — sin el drop quedarían ambas firmas vivas y
-- las llamadas existentes fallarían con "function ... is not unique".
-- ============================================================

alter table public.patients
  add column wants_event_notifications boolean not null default false,
  add column unsubscribe_token uuid not null default gen_random_uuid();

alter table public.leads
  add column wants_event_notifications boolean not null default false,
  add column unsubscribe_token uuid not null default gen_random_uuid();

alter table public.live_event_registrations
  add column wants_event_notifications boolean not null default false,
  add column unsubscribe_token uuid not null default gen_random_uuid();

create or replace function public.public_unsubscribe_notifications(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean := false;
begin
  update public.patients set wants_event_notifications = false where unsubscribe_token = p_token;
  if found then v_found := true; end if;

  update public.leads set wants_event_notifications = false where unsubscribe_token = p_token;
  if found then v_found := true; end if;

  update public.live_event_registrations set wants_event_notifications = false where unsubscribe_token = p_token;
  if found then v_found := true; end if;

  return jsonb_build_object('unsubscribed', v_found);
end;
$$;

grant execute on function public.public_unsubscribe_notifications(uuid) to anon, authenticated;

drop function if exists public.public_capture_lead(uuid, text, text, text, uuid, uuid, text, text, text, text, text, text);

create or replace function public.public_capture_lead(
  p_tenant_id uuid, p_email text, p_name text, p_phone text,
  p_landing_page_id uuid, p_lead_magnet_id uuid,
  p_utm_source text, p_utm_medium text, p_utm_campaign text,
  p_utm_content text, p_utm_term text, p_referrer text,
  p_wants_event_notifications boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id uuid;
begin
  insert into public.leads (
    tenant_id, email, name, phone, landing_page_id, lead_magnet_id,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
    wants_event_notifications
  )
  values (
    p_tenant_id, lower(p_email), p_name, p_phone, p_landing_page_id, p_lead_magnet_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_referrer,
    p_wants_event_notifications
  )
  on conflict (tenant_id, email) do update
    set name = coalesce(excluded.name, public.leads.name),
        phone = coalesce(excluded.phone, public.leads.phone),
        wants_event_notifications = excluded.wants_event_notifications or public.leads.wants_event_notifications,
        updated_at = now()
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

grant execute on function public.public_capture_lead(uuid, text, text, text, uuid, uuid, text, text, text, text, text, text, boolean) to anon, authenticated;

drop function if exists public.public_register_live_event(uuid, uuid, text, text);
drop function if exists public.public_register_live_event_as_user(uuid, uuid, text, text);

create or replace function public.public_register_live_event(
  p_tenant_id uuid, p_event_id uuid, p_email text, p_name text,
  p_wants_event_notifications boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity int;
  v_price int;
  v_taken int;
  v_reg_id uuid;
  v_status text;
begin
  select capacity, price_cents into v_capacity, v_price
  from public.live_events
  where id = p_event_id and tenant_id = p_tenant_id
    and published and status = 'scheduled'
  for update;

  if v_capacity is null then
    raise exception 'Evento no disponible';
  end if;

  select count(*) into v_taken
  from public.live_event_registrations
  where live_event_id = p_event_id
    and payment_status in ('free','paid','pending_payment');

  if v_taken >= v_capacity then
    raise exception 'El evento está lleno';
  end if;

  v_status := case when coalesce(v_price,0) = 0 then 'free' else 'pending_payment' end;

  insert into public.live_event_registrations (
    tenant_id, live_event_id, email, name, payment_status, wants_event_notifications
  )
  values (p_tenant_id, p_event_id, lower(p_email), p_name, v_status, p_wants_event_notifications)
  on conflict (live_event_id, email) do update
    set name = coalesce(excluded.name, public.live_event_registrations.name),
        wants_event_notifications = excluded.wants_event_notifications or public.live_event_registrations.wants_event_notifications
  returning id into v_reg_id;

  return v_reg_id;
end;
$$;

grant execute on function public.public_register_live_event(uuid, uuid, text, text, boolean) to anon, authenticated;

create or replace function public.public_register_live_event_as_user(
  p_tenant_id uuid, p_event_id uuid, p_email text, p_name text,
  p_wants_event_notifications boolean default false
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
  v_reg_id := public.public_register_live_event(p_tenant_id, p_event_id, p_email, p_name, p_wants_event_notifications);

  if v_uid is not null then
    update public.live_event_registrations
      set auth_user_id = v_uid
      where id = v_reg_id and auth_user_id is null;
  end if;

  return v_reg_id;
end;
$$;

grant execute on function public.public_register_live_event_as_user(uuid, uuid, text, text, boolean) to anon, authenticated;

drop function if exists public.public_create_appointment(uuid, timestamptz, timestamptz, text, text, text, text);

create or replace function public.public_create_appointment(
  p_tenant_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone,
  p_full_name text, p_email text, p_phone text, p_payment_mode text,
  p_wants_event_notifications boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  if exists (
    select 1 from public.appointments a
    where a.tenant_id = p_tenant_id
      and a.status in ('pending_payment','pending_verification','confirmed','completed')
      and a.start_at < p_end_at and a.end_at > p_start_at
  ) then
    raise exception 'El horario ya no está disponible';
  end if;

  insert into public.patients (tenant_id, full_name, email, phone, wants_event_notifications)
  values (p_tenant_id, p_full_name, lower(p_email), p_phone, p_wants_event_notifications)
  on conflict (tenant_id, email)
  do update set full_name = excluded.full_name,
                phone = coalesce(excluded.phone, public.patients.phone),
                wants_event_notifications = excluded.wants_event_notifications or public.patients.wants_event_notifications
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
$$;

grant execute on function public.public_create_appointment(uuid, timestamptz, timestamptz, text, text, text, text, boolean) to anon, authenticated;
