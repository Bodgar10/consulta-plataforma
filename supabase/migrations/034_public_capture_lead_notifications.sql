-- ============================================================
-- 034_public_capture_lead_notifications.sql
-- Agrega p_wants_event_notifications (default false, no rompe
-- llamadas existentes) a public_capture_lead. El OR en el upsert
-- evita que un segundo submit sin checkbox apague el consentimiento
-- ya dado antes.
-- ============================================================

-- `create or replace` con distinta aridad NO reemplaza: crea una sobrecarga.
-- La versión de 12 args (003_embudo) quedaría viva y toda llamada con 12 args
-- (la del route actual) sería ambigua -> 42725 "function is not unique".
-- Se elimina explícitamente antes de crear la de 13.
drop function if exists public.public_capture_lead(
  uuid, text, text, text, uuid, uuid, text, text, text, text, text, text
);

create or replace function public.public_capture_lead(
  p_tenant_id uuid, p_email text, p_name text, p_phone text,
  p_landing_page_id uuid, p_lead_magnet_id uuid,
  p_utm_source text, p_utm_medium text, p_utm_campaign text,
  p_utm_content text, p_utm_term text, p_referrer text,
  p_wants_event_notifications boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id uuid;
begin
  insert into public.leads (
    tenant_id, email, name, phone, landing_page_id, lead_magnet_id,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
    wants_event_notifications
  )
  values (
    p_tenant_id, lower(p_email), p_name, p_phone, p_landing_page_id, p_lead_magnet_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_referrer,
    p_wants_event_notifications
  )
  on conflict (tenant_id, email) do update
    set name = coalesce(excluded.name, public.leads.name),
        phone = coalesce(excluded.phone, public.leads.phone),
        wants_event_notifications = excluded.wants_event_notifications or public.leads.wants_event_notifications,
        updated_at = now()
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

grant execute on function public.public_capture_lead(uuid, text, text, text, uuid, uuid, text, text, text, text, text, text, boolean) to anon, authenticated;
