-- ============================================================
-- 008_current_user_context.sql
-- RPC de contexto post-login para el redirect por rol en /auth/callback:
-- distingue profesional de paciente y devuelve el slug de su tenant.
-- Independiente de 007/009 (puede aplicarse en cualquier orden).
-- Depende de: 001 (tenant_members, tenants), 002 (patients).
-- ============================================================

-- Profesional = fila en tenant_members.
-- Paciente    = cuenta vinculada en patients (auth_user_id) y NO en tenant_members.
-- security definer: un paciente NO puede leer public.tenants por RLS
-- (tenants_select_member es solo para miembros); esta función le resuelve
-- el slug de su tenant sin abrir esa tabla. Devuelve 0 filas si el usuario
-- autenticado aún no tiene contexto (login recién, sin vínculo) -> el
-- frontend debe mandar a un fallback en ese caso.
create or replace function public.current_user_context()
returns table (is_professional boolean, tenant_slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select true as is_professional, t.slug as tenant_slug
  from public.tenant_members tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.auth_user_id = auth.uid()

  union all

  select false as is_professional, t.slug as tenant_slug
  from public.patients p
  join public.tenants t on t.id = p.tenant_id
  where p.auth_user_id = auth.uid()
    and not exists (
      select 1 from public.tenant_members tm2
      where tm2.auth_user_id = auth.uid()
    )
  limit 1
$$;

grant execute on function public.current_user_context() to authenticated;
