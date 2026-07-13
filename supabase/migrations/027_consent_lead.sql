-- ============================================================
-- 027_consent_lead.sql
-- Consentimiento de CONTACTO en captura de lead (embudo). Nivel distinto al
-- consentimiento expreso de salud: aquí es tratamiento de datos de contacto,
-- el lead aún no es paciente. Se marca con consent_kind='contact'.
-- Añade consents.lead_id (ON DELETE SET NULL) + consent_kind + función definer.
-- Depende de 007_consent y 003 (leads).
-- ============================================================

alter table public.consents
  add column if not exists lead_id uuid
    references public.leads(id) on delete set null;

-- Discriminador del tipo de consentimiento. Default 'health' para no reclasificar
-- los existentes (booking/eventos son de salud). Los de lead serán 'contact'.
alter table public.consents
  add column if not exists consent_kind text not null default 'health'
    check (consent_kind in ('health','contact'));

create index if not exists idx_consents_lead
  on public.consents(lead_id) where lead_id is not null;

-- Registra consentimiento de contacto para un lead. Deriva tenant del lead.
create or replace function public.public_record_lead_consent(
  p_lead_id uuid,
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
  v_tenant_id uuid;
  v_consent_id uuid;
begin
  if coalesce(p_privacy_version,'') = '' then
    raise exception 'privacy_version requerida';
  end if;

  select tenant_id into v_tenant_id
  from public.leads
  where id = p_lead_id;

  if v_tenant_id is null then
    raise exception 'lead no encontrado';
  end if;

  insert into public.consents (tenant_id, lead_id, privacy_version, ip, user_agent, consent_kind)
  values (v_tenant_id, p_lead_id, p_privacy_version, p_ip, p_user_agent, 'contact')
  returning id into v_consent_id;

  return v_consent_id;
end;
$$;

grant execute on function public.public_record_lead_consent(uuid, text, text, text) to anon, authenticated;
