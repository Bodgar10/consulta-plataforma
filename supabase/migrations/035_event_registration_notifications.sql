-- ============================================================
-- 035_event_registration_notifications.sql
-- Agrega p_wants_event_notifications a public_register_live_event
-- y public_register_live_event_as_user. Mismo patrón OR-en-upsert
-- que 034 (public_capture_lead): nunca apaga un consentimiento ya dado.
-- ============================================================

-- Igual que en 034: `create or replace` con distinta aridad crea una sobrecarga
-- en vez de reemplazar. Las versiones de 4 args (005 y 028) quedarían vivas y la
-- llamada del route (4 args) sería ambigua -> 42725 "function is not unique".
drop function if exists public.public_register_live_event(uuid, uuid, text, text);

create or replace function public.public_register_live_event(
  p_tenant_id uuid, p_event_id uuid, p_email text, p_name text,
  p_wants_event_notifications boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity int;
  v_price int;
  v_taken int;
  v_reg_id uuid;
  v_status text;
begin
  select capacity, price_cents into v_capacity, v_price
  from public.live_events
  where id = p_event_id and tenant_id = p_tenant_id
    and published and status = 'scheduled'
  for update;

  if v_capacity is null then
    raise exception 'Evento no disponible';
  end if;

  select count(*) into v_taken
  from public.live_event_registrations
  where live_event_id = p_event_id
    and payment_status in ('free','paid','pending_payment');

  if v_taken >= v_capacity then
    raise exception 'El evento está lleno';
  end if;

  v_status := case when coalesce(v_price,0) = 0 then 'free' else 'pending_payment' end;

  insert into public.live_event_registrations (
    tenant_id, live_event_id, email, name, payment_status, wants_event_notifications
  )
  values (p_tenant_id, p_event_id, lower(p_email), p_name, v_status, p_wants_event_notifications)
  on conflict (live_event_id, email) do update
    set name = coalesce(excluded.name, public.live_event_registrations.name),
        wants_event_notifications = excluded.wants_event_notifications or public.live_event_registrations.wants_event_notifications
  returning id into v_reg_id;

  return v_reg_id;
end;
$$;

grant execute on function public.public_register_live_event(uuid, uuid, text, text, boolean) to anon, authenticated;

drop function if exists public.public_register_live_event_as_user(uuid, uuid, text, text);

create or replace function public.public_register_live_event_as_user(
  p_tenant_id uuid, p_event_id uuid, p_email text, p_name text,
  p_wants_event_notifications boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_reg_id uuid;
begin
  v_uid := auth.uid();
  v_reg_id := public.public_register_live_event(p_tenant_id, p_event_id, p_email, p_name, p_wants_event_notifications);

  if v_uid is not null then
    update public.live_event_registrations
      set auth_user_id = v_uid
      where id = v_reg_id and auth_user_id is null;
  end if;

  return v_reg_id;
end;
$$;

grant execute on function public.public_register_live_event_as_user(uuid, uuid, text, text, boolean) to anon, authenticated;
