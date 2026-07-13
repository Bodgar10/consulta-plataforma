-- ============================================================
-- 026_consent_event.sql
-- Extiende el registro de consentimiento a eventos en vivo.
-- Añade consents.registration_id (append-only: ON DELETE SET NULL) y una
-- función definer espejo de public_record_consent para eventos.
-- Depende de 007_consent y 005 (live_event_registrations).
-- ============================================================

alter table public.consents
  add column if not exists registration_id uuid
    references public.live_event_registrations(id) on delete set null;

create index if not exists idx_consents_registration
  on public.consents(registration_id) where registration_id is not null;

-- Registra consentimiento para un registro de evento. Deriva tenant del propio
-- registro (no se confía en un tenant pasado suelto). La versión la ancla quien
-- llama con la vigente (server-side); aquí solo se valida no-vacío.
create or replace function public.public_record_event_consent(
  p_registration_id uuid,
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
  from public.live_event_registrations
  where id = p_registration_id;

  if v_tenant_id is null then
    raise exception 'registro de evento no encontrado';
  end if;

  insert into public.consents (tenant_id, registration_id, privacy_version, ip, user_agent)
  values (v_tenant_id, p_registration_id, p_privacy_version, p_ip, p_user_agent)
  returning id into v_consent_id;

  return v_consent_id;
end;
$$;

grant execute on function public.public_record_event_consent(uuid, text, text, text) to anon, authenticated;
