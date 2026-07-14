-- ============================================================
-- 032_public_get_published_landings.sql
-- Lista slugs de landings publicadas de un tenant. Alimenta el
-- redirect aleatorio de [tenant]/page.tsx cuando se entra sin slug.
-- Mismo patrón de siempre, solo lectura.
-- ============================================================

create or replace function public.public_get_published_landings(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', lp.slug) order by lp.slug), '[]'::jsonb)
  from public.landing_pages lp
  where lp.tenant_id = p_tenant_id and lp.published
$$;

grant execute on function public.public_get_published_landings(uuid) to anon, authenticated;
