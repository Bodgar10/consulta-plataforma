-- ============================================================
-- 031_public_get_upcoming_events.sql
-- Listado dinámico de eventos publicados y futuros. Alimenta la
-- sección "Eventos en vivo" de la landing — sin hardcode de IDs.
-- Mismo patrón que public_get_live_event (incluye seats_taken).
-- ============================================================

create or replace function public.public_get_upcoming_events(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'description', e.description,
      'start_at', e.start_at,
      'end_at', e.end_at,
      'price_cents', e.price_cents,
      'capacity', e.capacity,
      'seats_taken', (
        select count(*) from public.live_event_registrations r
        where r.live_event_id = e.id
          and r.payment_status in ('free','paid','pending_payment')
      )
    ) order by e.start_at
  ), '[]'::jsonb)
  from public.live_events e
  where e.tenant_id = p_tenant_id
    and e.published
    and e.status = 'scheduled'
    and e.start_at > now()
$$;

grant execute on function public.public_get_upcoming_events(uuid) to anon, authenticated;
