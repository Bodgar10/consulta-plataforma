-- ============================================================
-- 039_public_get_tenant_slug.sql
-- Traduce tenant_id -> slug para construir links de /mi-cuenta
-- (cross-tenant, solo tiene tenant_id disponible). Solo authenticated.
-- ============================================================

create or replace function public.public_get_tenant_slug(p_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select slug from public.tenants where id = p_tenant_id and status = 'active'
$$;

grant execute on function public.public_get_tenant_slug(uuid) to authenticated;
