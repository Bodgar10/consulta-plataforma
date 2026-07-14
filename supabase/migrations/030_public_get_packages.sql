-- ============================================================
-- 029_public_get_packages.sql
-- Versiona en el repo una función que YA EXISTE en el remoto (creada
-- fuera de migraciones, sin registro). Contenido verificado con
-- pg_get_functiondef contra Supabase antes de escribir este archivo.
-- No es una función nueva: es documentar la que ya está viva.
-- ============================================================

create or replace function public.public_get_packages(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sessions_count', p.sessions_count,
      'price_cents', p.price_cents,
      'valid_days', p.valid_days
    ) order by p.sessions_count
  ), '[]'::jsonb)
  from public.packages p
  where p.tenant_id = p_tenant_id and p.active
$$;

grant execute on function public.public_get_packages(uuid) to anon, authenticated;
