-- ============================================================
-- 001_tenancy.sql
-- Núcleo multi-tenant: tenants + tenant_members.
-- Correr PRIMERO. Todo lo demás depende de esto.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Trigger genérico de updated_at (reutilizado en todas las migraciones)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- tenants (GLOBAL, sin tenant_id) — un profesional = un tenant
-- ------------------------------------------------------------
create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,                  -- subdominio / path
  custom_domain   text unique,                           -- nullable; dominio propio (tier premium / piloto)
  display_name    text not null,
  branding        jsonb not null default '{}'::jsonb,    -- { logo_url, color_primary, ... }
  timezone        text not null default 'America/Mexico_City',
  payment_settings jsonb not null default '{}'::jsonb,   -- { accepts_transfer, clabe, banco, titular, whatsapp }
  status          text not null default 'active',        -- active | suspended
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_tenants_updated
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- tenant_members (GLOBAL) — mapea usuarios auth -> tenant + rol
-- En MVP: una fila (mamá = owner). Prepara gratis el caso "recepcionista".
-- ------------------------------------------------------------
create table public.tenant_members (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'owner',           -- owner | staff
  created_at    timestamptz not null default now(),
  unique (tenant_id, auth_user_id)
);

create index idx_tenant_members_user on public.tenant_members(auth_user_id);

-- ------------------------------------------------------------
-- Helper de RLS: tenant_ids del usuario autenticado.
-- security definer + search_path bloqueado para evitar recursión de RLS
-- y secuestro de search_path.
-- ------------------------------------------------------------
create or replace function public.current_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id
  from public.tenant_members
  where auth_user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

-- Un miembro lee su propio tenant.
create policy tenants_select_member on public.tenants
  for select to authenticated
  using (id in (select public.current_user_tenant_ids()));

-- Solo el owner edita su tenant.
create policy tenants_update_owner on public.tenants
  for update to authenticated
  using (
    id in (
      select tenant_id from public.tenant_members
      where auth_user_id = auth.uid() and role = 'owner'
    )
  );

-- Un miembro ve a los miembros de su tenant.
create policy tenant_members_select on public.tenant_members
  for select to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

-- Nota: el alta de tenants/members se hace con service_role (onboarding del SaaS
-- o seed del piloto), que bypassa RLS. No exponemos mutaciones a anon/authenticated aquí.
