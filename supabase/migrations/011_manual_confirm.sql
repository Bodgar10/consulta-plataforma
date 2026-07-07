-- ============================================================
-- 011_manual_confirm.sql
-- Sprint 2 · Confirmación manual de transferencia (carril Opus).
-- La profesional (owner del tenant, sesión authenticated) marca pagada una cita
-- en 'pending_verification' cuando recibió la transferencia por fuera de la
-- plataforma (BRINCA Connect: el dinero no pasó por Stripe, solo se registra).
--
-- ATÓMICA. NO crea sala Daily, NO manda correo, NO descuenta crédito: eso lo
-- hace el helper único de app (src/lib/booking/confirm.ts) para no duplicar la
-- llamada a Daily desde SQL. Devuelve { id, status, transitioned }:
--   transitioned=true  -> acabó de pasar de pending_verification a confirmed.
--   transitioned=false -> ya estaba confirmed (idempotente; el caller NO
--                         debe re-disparar efectos, para no mandar 2do correo).
-- Correr DESPUÉS de 001-005 y de las migraciones de Sprint 1 (006, 007).
-- ============================================================

create or replace function public.confirm_transfer_payment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  -- Definer bypassa RLS => el aislamiento por tenant se impone A MANO aquí.
  -- FOR UPDATE serializa dos confirmaciones simultáneas de la misma cita.
  select a.status into v_status
  from public.appointments a
  where a.id = p_appointment_id
    and a.tenant_id in (select public.current_user_tenant_ids())
  for update;

  if not found then
    raise exception 'Cita no encontrada o fuera de tu consulta';
  end if;

  -- Idempotente: ya confirmada => no re-transiciona ni re-dispara efectos.
  if v_status = 'confirmed' then
    return jsonb_build_object('id', p_appointment_id, 'status', 'confirmed', 'transitioned', false);
  end if;

  if v_status <> 'pending_verification' then
    raise exception 'La cita no está pendiente de verificación (estado: %)', v_status;
  end if;

  update public.appointments
  set status      = 'confirmed',
      verified_by = auth.uid(),
      verified_at = now()
  where id = p_appointment_id;

  return jsonb_build_object('id', p_appointment_id, 'status', 'confirmed', 'transitioned', true);
end;
$$;

grant execute on function public.confirm_transfer_payment(uuid) to authenticated;
