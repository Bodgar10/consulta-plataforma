-- ============================================================
-- 040_public_get_appointment_status.sql
-- Estado real de una cita para la página de confirmación pública.
-- Corrige bug: la página mostraba "pago confirmado" solo por traer
-- ?payment_mode=card en la URL, sin verificar nada contra BD —
-- cualquiera podía construir esa URL a mano. Solo expone status +
-- payment_mode, nada de datos personales del paciente.
-- ============================================================

create or replace function public.public_get_appointment_status(p_appointment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('status', status, 'payment_mode', payment_mode)
  from public.appointments
  where id = p_appointment_id
$$;

grant execute on function public.public_get_appointment_status(uuid) to anon, authenticated;
