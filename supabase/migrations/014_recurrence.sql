-- ============================================================
-- 014_recurrence.sql
-- Sprint 2b · Recurrencias (carril Opus). Bulk-create simple: N instancias
-- reales ligadas por recurrence_group_id. Motor de reglas = Fase 2.
--
-- Política: TODO-O-NADA (decisión del orquestador). Si UNA fecha choca, se
-- revierte el lote completo (la función es una sola transacción) y se informa
-- qué fecha falló. Cada instancia nace igual que la cita manual (G1):
-- confirmed, created_by='professional', hold NULL, mismo recurrence_group_id.
--
-- Genera N fechas a partir de mañana que caen en p_weekday (0=domingo..6=sábado),
-- preservando la hora/min de p_start_at (que trae la hora deseada). Husos: las
-- marcas son timestamptz en UTC; el endpoint ya manda las horas correctas en UTC.
-- ============================================================

create or replace function public.professional_create_recurrence(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_weekday int,
  p_occurrences int,
  p_patient_id uuid default null,
  p_full_name text default null,
  p_email text default null,
  p_phone text default null,
  p_payment_mode text default 'external'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_patient_id uuid;
  v_group_id uuid := gen_random_uuid();
  v_duration interval := p_end_at - p_start_at;
  v_created uuid[] := array[]::uuid[];
  v_cursor timestamptz;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_count int := 0;
  v_appt_id uuid;
begin
  select tid into v_tenant_id
  from public.current_user_tenant_ids() as tid
  limit 1;
  if v_tenant_id is null then
    raise exception 'Sin tenant en la sesión';
  end if;

  if p_weekday < 0 or p_weekday > 6 then
    raise exception 'weekday debe estar entre 0 y 6';
  end if;
  if p_occurrences < 1 or p_occurrences > 52 then
    raise exception 'occurrences debe estar entre 1 y 52';
  end if;
  if v_duration <= interval '0' then
    raise exception 'El fin debe ser posterior al inicio';
  end if;

  -- Resolver paciente una sola vez (existente validado al tenant, o upsert nuevo).
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

  -- Primer slot: el primer p_weekday en/después de la fecha de p_start_at,
  -- preservando su hora. extract(dow) de Postgres: 0=domingo..6=sábado.
  v_cursor := p_start_at;
  while extract(dow from v_cursor)::int <> p_weekday loop
    v_cursor := v_cursor + interval '1 day';
  end loop;

  while v_count < p_occurrences loop
    v_slot_start := v_cursor;
    v_slot_end := v_cursor + v_duration;

    -- Capa 1: mensaje limpio identificando la fecha que choca.
    if exists (
      select 1 from public.appointments a
      where a.tenant_id = v_tenant_id
        and a.status in ('pending_payment','pending_verification','confirmed','completed')
        and a.start_at < v_slot_end and a.end_at > v_slot_start
    ) then
      raise exception 'Traslape en % — se abortó el lote completo', v_slot_start::text
        using errcode = '23P01';
    end if;

    -- Capa 2: EXCLUDE es el backstop atómico; si salta, revierte todo el lote.
    insert into public.appointments (
      tenant_id, patient_id, start_at, end_at, status,
      payment_mode, created_by, hold_expires_at, verified_by, verified_at,
      recurrence_group_id
    )
    values (
      v_tenant_id, v_patient_id, v_slot_start, v_slot_end, 'confirmed',
      p_payment_mode, 'professional', null, auth.uid(), now(),
      v_group_id
    )
    returning id into v_appt_id;

    v_created := array_append(v_created, v_appt_id);
    v_count := v_count + 1;
    v_cursor := v_cursor + interval '7 days';
  end loop;

  return jsonb_build_object(
    'recurrence_group_id', v_group_id,
    'patient_id', v_patient_id,
    'created', to_jsonb(v_created)
  );
end;
$$;

grant execute on function public.professional_create_recurrence(
  timestamptz, timestamptz, int, int, uuid, text, text, text, text
) to authenticated;
