-- ============================================================
-- 009_public_get_tenant_by_domain.sql
-- Resolver público de tenant por dominio custom, espejo de
-- public_get_tenant_by_slug. Para el middleware cuando el host es un
-- dominio propio del profesional. Independiente de 007/008.
-- Depende de: 001 (tenants.custom_domain).
-- Mismo patrón que el resto de public_*: security definer + search_path
-- bloqueado + grant a anon. Expone solo lo necesario para landing/booking,
-- nunca credenciales.
-- ============================================================
create or replace function public.public_get_tenant_by_domain(p_domain text)
returns table (id uuid, display_name text, branding jsonb, timezone text, payment_settings jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.display_name, t.branding, t.timezone,
         jsonb_build_object(
           'accepts_transfer', coalesce(t.payment_settings->>'accepts_transfer','false')::boolean,
           'whatsapp', t.payment_settings->>'whatsapp',
           'banco', t.payment_settings->>'banco',
           'titular', t.payment_settings->>'titular',
           'clabe', t.payment_settings->>'clabe'
         )
  from public.tenants t
  where lower(t.custom_domain) = lower(p_domain) and t.status = 'active'
$$;

grant execute on function public.public_get_tenant_by_domain(text) to anon, authenticated;
