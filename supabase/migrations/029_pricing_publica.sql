-- ============================================================
-- 006_pricing_publica.sql
-- Agrega session_price_cents a public_get_tenant_by_slug.
-- Solo lectura, mismo patrón de siempre. Ya aplicado en remoto vía SQL Editor;
-- este archivo lo deja versionado en el repo.
-- ============================================================

create or replace function public.public_get_tenant_by_slug(p_slug text)
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
           'clabe', t.payment_settings->>'clabe',
           'session_price_cents', (t.payment_settings->>'session_price_cents')::int
         )
  from public.tenants t
  where t.slug = p_slug and t.status = 'active'
$$;
