-- ============================================================
-- 010_get_tenant_by_domain_add_slug.sql
-- Agrega slug al returns de public_get_tenant_by_domain para que el
-- middleware (resolvedor trilateral, diseño A) pueda rellenar x-tenant-slug
-- y las páginas [tenant] (que usan public_get_tenant_by_slug) sigan igual.
-- Cambiar el returns table cambia el TIPO DE RETORNO -> CREATE OR REPLACE
-- no lo permite: hay que DROP + recrear la función completa.
-- Depende de: 001 (tenants.slug not null unique), 009 (función previa).
-- ============================================================

drop function if exists public.public_get_tenant_by_domain(text);

create function public.public_get_tenant_by_domain(p_domain text)
returns table (id uuid, slug text, display_name text, branding jsonb, timezone text, payment_settings jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.slug, t.display_name, t.branding, t.timezone,
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
