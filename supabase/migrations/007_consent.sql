-- ============================================================
-- 007_consent.sql
-- Evidencia de consentimiento LFPDPPP (autoridad SABG, vigente 2025).
-- Una fila por aceptación en el flujo de booking. NO es historia clínica.
-- Depende de: 001 (tenants + current_user_tenant_ids),
-- 002 (patients, appointments). Correr DESPUÉS de 006.
-- ============================================================

-- ------------------------------------------------------------
-- consents — constancia de aceptación del aviso de privacidad.
-- patient_id / appointment_id nullable + ON DELETE SET NULL: la evidencia
-- SOBREVIVE aunque se borre la cita o el paciente (retención legal).
-- tenant_id es la única FK que cascadea (offboarding del tenant).
-- Tabla append-only: sin updated_at ni trigger (la evidencia es inmutable).
-- ------------------------------------------------------------
create table public.consents (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  patient_id      uuid references public.patients(id) on delete set null,
  appointment_id  uuid references public.appointments(id) on delete set null,
  privacy_version text not null,
  accepted_at     timestamptz not null default now(),
  ip              text,          -- x-forwarded-for (texto tolerante, no inet)
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index idx_consents_tenant on public.consents(tenant_id);
create index idx_consents_patient on public.consents(patient_id);
create index idx_consents_appointment on public.consents(appointment_id);

-- ------------------------------------------------------------
-- RLS — lente profesional para lectura. Sin políticas de insert:
-- el alta ocurre solo vía public_record_consent (security definer, que
-- bypassa RLS) o service_role. anon/authenticated NO insertan directo
-- (default-deny, coherente con el resto del schema).
-- ------------------------------------------------------------
alter table public.consents enable row level security;

create policy consents_pro_select on public.consents
  for select to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

-- ------------------------------------------------------------
-- public_record_consent — frontera pública (mismo patrón que el resto de
-- public_*: security definer + search_path bloqueado + grant a anon).
-- Recibe SOLO el appointment_id y deriva tenant_id/patient_id de la cita
-- (fuente de verdad; el cliente no puede falsearlos). La cita ya existe en
-- los cuatro caminos al llamar: card/oxxo -> pending_payment,
-- transfer -> pending_verification, credit -> confirmed.
-- ------------------------------------------------------------
create or replace function public.public_record_consent(
  p_appointment_id uuid,
  p_privacy_version text,
  p_ip text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id  uuid;
  v_patient_id uuid;
  v_consent_id uuid;
begin
  if coalesce(p_privacy_version, '') = '' then
    raise exception 'privacy_version requerida para registrar consentimiento';
  end if;

  select a.tenant_id, a.patient_id
    into v_tenant_id, v_patient_id
  from public.appointments a
  where a.id = p_appointment_id;

  if v_tenant_id is null then
    raise exception 'appointment inexistente para registrar consentimiento';
  end if;

  insert into public.consents (
    tenant_id, patient_id, appointment_id, privacy_version, ip, user_agent
  )
  values (
    v_tenant_id, v_patient_id, p_appointment_id, p_privacy_version, p_ip, p_user_agent
  )
  returning id into v_consent_id;

  return v_consent_id;
end;
$$;

grant execute on function public.public_record_consent(uuid, text, text, text) to anon, authenticated;
