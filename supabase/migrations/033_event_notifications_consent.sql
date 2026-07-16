-- ============================================================
-- 033_event_notifications_consent.sql
-- Checkbox de consentimiento para anuncios de talleres/cursos,
-- capturado en booking, inscripción a evento, y captura de lead.
-- Token de baja único por registro, sin requerir login.
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
