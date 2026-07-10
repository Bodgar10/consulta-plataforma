-- ============================================================
-- 017_credit_return_on_cancel.sql
-- Devuelve el crédito al cancelar (branch 'cancel' de professional_update_appointment)
-- SOLO si faltan >24h para start_at. Atómico e idempotente. No toca el branch 'reschedule'.
-- ============================================================

create or replace function public.professional_update_appointment(
  p_appointment_id uuid,
  p_action text,
  p_start_at timestamp with time zone default null::timestamp with time zone,
  p_end_at timestamp with time zone default null::timestamp with time zone
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tenant_id uuid;
  v_status text;
  v_credit_id uuid;
  v_payment_mode text;
  v_start_at timestamp with time zone;
  v_refunded boolean := false;
begin
  select tid into v_tenant_id
  from public.current_user_tenant_ids() as tid
  limit 1;
  if v_tenant_id is null then
    raise exception 'Sin tenant en la sesión';
  end if;

  -- Bloquea la fila y trae también lo necesario para la devolución de crédito.
  select status, credit_id, payment_mode, start_at
    into v_status, v_credit_id, v_payment_mode, v_start_at
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

    -- Devolución de crédito: regla por TIEMPO (>24h), no por actor. Zona-agnóstica.
    if v_payment_mode = 'credit' and v_credit_id is not null
       and (v_start_at - now()) > interval '24 hours' then
      update public.patient_credits
        set sessions_used = sessions_used - 1
      where id = v_credit_id and sessions_used > 0;
      if found then
        v_refunded := true;
      end if;
    end if;

    return jsonb_build_object('id', p_appointment_id, 'status', 'cancelled',
                             'credit_returned', v_refunded);

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

    if exists (
      select 1 from public.appointments a
      where a.tenant_id = v_tenant_id
        and a.id <> p_appointment_id
        and a.status in ('pending_payment','pending_verification','confirmed','completed')
        and a.start_at < p_end_at and a.end_at > p_start_at
    ) then
      raise exception 'El horario ya no está disponible' using errcode = '23P01';
    end if;

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
$function$;
