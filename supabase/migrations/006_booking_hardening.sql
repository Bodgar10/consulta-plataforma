-- ============================================================
-- 006_booking_hardening.sql
-- Sprint 1. NO toca 001-005; las complementa. Correr DESPUÉS de 005.
--   CAMBIO 1: appointments.stripe_payment_intent (idempotencia del webhook)
--   CAMBIO 2: public_create_credit_appointment (pago con paquete prepagado)
--   CAMBIO 3: ampliar idx_appts_holds a pending_payment + pending_verification
-- ============================================================

-- ------------------------------------------------------------
-- CAMBIO 1 · Idempotencia del webhook de Stripe.
-- Un payment_intent mapea a UNA sola cita; el índice único parcial
-- garantiza que re-procesar el mismo evento no cree/duplique nada.
-- ------------------------------------------------------------
alter table public.appointments
  add column if not exists stripe_payment_intent text;

create unique index if not exists uq_appts_payment_intent
  on public.appointments (stripe_payment_intent)
  where stripe_payment_intent is not null;

-- ------------------------------------------------------------
-- CAMBIO 3 · El futuro cron de release-holds perseguirá ambos estados.
-- (hoy sólo indexaba pending_verification; el path Stripe deja pending_payment)
-- ------------------------------------------------------------
drop index if exists public.idx_appts_holds;
create index idx_appts_holds on public.appointments (hold_expires_at)
  where hold_expires_at is not null
    and status in ('pending_payment','pending_verification');

-- ------------------------------------------------------------
-- CAMBIO 2 · Reserva pagando con crédito prepagado (paquete).
-- Identifica al paciente por (tenant, email), toma su crédito elegible
-- más próximo a vencer (FIFO), lo BLOQUEA (for update), crea la cita
-- CONFIRMADA y descuenta una sesión — todo atómico. El EXCLUDE cubre
-- la doble-reserva (propaga su error). hold_expires_at NULL => el cron
-- nunca la toca.
-- ------------------------------------------------------------
create or replace function public.public_create_credit_appointment(
  p_tenant_id  uuid,
  p_start_at   timestamptz,
  p_end_at     timestamptz,
  p_full_name  text,
  p_email      text,
  p_phone      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_credit_id  uuid;
  v_appt_id    uuid;
begin
  -- Upsert del paciente por (tenant, email), como invitado (sin auth_user_id).
  insert into public.patients (tenant_id, full_name, email, phone)
  values (p_tenant_id, p_full_name, lower(p_email), p_phone)
  on conflict (tenant_id, email)
  do update set full_name = excluded.full_name,
                phone = coalesce(excluded.phone, public.patients.phone)
  returning id into v_patient_id;

  -- Crédito elegible: activo, con sesiones libres, no vencido. FIFO por vencimiento.
  -- FOR UPDATE serializa el consumo del último cupo entre reservas concurrentes.
  select id into v_credit_id
  from public.patient_credits
  where tenant_id = p_tenant_id
    and patient_id = v_patient_id
    and status = 'active'
    and sessions_used < sessions_total
    and expires_at > now()
  order by expires_at asc
  for update
  limit 1;

  if v_credit_id is null then
    raise exception 'No tienes sesiones disponibles en tu paquete';
  end if;

  insert into public.appointments (
    tenant_id, patient_id, start_at, end_at, status,
    payment_mode, credit_id, created_by, hold_expires_at
  )
  values (
    p_tenant_id, v_patient_id, p_start_at, p_end_at, 'confirmed',
    'credit', v_credit_id, 'patient', null
  )
  returning id into v_appt_id;

  update public.patient_credits
  set sessions_used = sessions_used + 1
  where id = v_credit_id;

  return v_appt_id;
end;
$$;

grant execute on function public.public_create_credit_appointment(
  uuid, timestamptz, timestamptz, text, text, text
) to anon, authenticated;
