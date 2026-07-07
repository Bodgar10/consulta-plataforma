-- ============================================================
-- 016_update_appointment.sql
-- Sprint 2b · Cancelar / reagendar una cita desde el panel (carril Opus).
--
-- Cancelar: solo desde pending_payment | pending_verification | confirmed ->
--   cancelled. Otra transición (completed, no_show, ya cancelled) -> error.
-- Reagendar: cambia start_at/end_at re-validando traslape (excluye la propia
--   cita) con mensaje limpio; EXCLUDE es el backstop atómico.
--
-- Sala Daily al cancelar: se deja EXPIRAR sola (decisión del orquestador); Daily
--   la limpia por 'exp'. No se borra aquí (sin llamada extra).
-- Devolución de crédito al cancelar (sessions_used -= 1): NO se automatiza en
--   este sprint — decisión de negocio pendiente de validación humana. Esta
--   función NO toca patient_credits.
-- Cancelar una instancia suelta de una recurrencia NO afecta a las demás del
--   grupo (eso es intencional; "cancelar todas las futuras" es H2).
-- Tenant impuesto por la sesión.
-- ============================================================

create or replace function public.professional_update_appointment(
  p_appointment_id uuid,
  p_action text,                    -- 'cancel' | 'reschedule'
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_status text;
begin
  select tid into v_tenant_id
  from public.current_user_tenant_ids() as tid
  limit 1;
  if v_tenant_id is null then
    raise exception 'Sin tenant en la sesión';
  end if;

  -- Bloquear la fila, ya filtrada al tenant de la sesión.
  select status into v_status
  from public.appointments
  where id = p_appointment_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Cita no encontrada o fuera de tu consulta';
  end if;

  if p_action = 'cancel' then
    if v_status not in ('pending_payment','pending_verification','confirmed') then
      raise exception 'No se puede cancelar una cita en estado %', v_status;
    end if;

    update public.appointments
    set status = 'cancelled'
    where id = p_appointment_id;

    return jsonb_build_object('id', p_appointment_id, 'status', 'cancelled');

  elsif p_action = 'reschedule' then
    if p_start_at is null or p_end_at is null then
      raise exception 'Reagendar requiere start_at y end_at';
    end if;
    if p_end_at <= p_start_at then
      raise exception 'El fin debe ser posterior al inicio';
    end if;
    if v_status not in ('pending_payment','pending_verification','confirmed') then
      raise exception 'No se puede reagendar una cita en estado %', v_status;
    end if;

    -- Capa 1: traslape con mensaje limpio, EXCLUYENDO la propia cita.
    if exists (
      select 1 from public.appointments a
      where a.tenant_id = v_tenant_id
        and a.id <> p_appointment_id
        and a.status in ('pending_payment','pending_verification','confirmed','completed')
        and a.start_at < p_end_at and a.end_at > p_start_at
    ) then
      raise exception 'El horario ya no está disponible' using errcode = '23P01';
    end if;

    -- Capa 2: EXCLUDE es el backstop atómico ante carrera.
    update public.appointments
    set start_at = p_start_at,
        end_at = p_end_at
    where id = p_appointment_id;

    return jsonb_build_object('id', p_appointment_id, 'status', v_status,
                              'start_at', p_start_at, 'end_at', p_end_at);
  else
    raise exception 'action inválida: usa cancel o reschedule';
  end if;
end;
$$;

grant execute on function public.professional_update_appointment(uuid, text, timestamptz, timestamptz) to authenticated;
