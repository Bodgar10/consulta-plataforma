-- ============================================================
-- 022_legal_documents.sql
-- Versionado de documentos legales por tenant (aviso de privacidad, términos).
-- Fuente de verdad de QUÉ decía cada versión. Append-friendly: nunca se borra
-- una versión; se marca la vigente con is_current. Multi-tenant + RLS.
-- La lectura pública de la vigente va por función definer (023); la escritura
-- por función definer bajo owner (024). Aquí: tabla + RLS de lectura del owner.
-- ============================================================

create table public.legal_documents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  doc_type      text not null check (doc_type in ('privacy','terms')),
  version       text not null,                 -- semver textual, p. ej. '1.0.0'
  content       jsonb not null default '{}'::jsonb,  -- { title, sections:[{heading, body}], ... }
  published_at  timestamptz not null default now(),
  is_current    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (tenant_id, doc_type, version)
);

create index idx_legal_docs_tenant on public.legal_documents(tenant_id);

-- Una sola versión vigente por (tenant, tipo). Índice único parcial.
create unique index uidx_legal_docs_current
  on public.legal_documents(tenant_id, doc_type)
  where is_current;

-- ------------------------------------------------------------
-- RLS: el owner lee sus documentos (panel). Escritura: solo service_role /
-- función definer (024). Lectura pública de la vigente: función definer (023).
-- ------------------------------------------------------------
alter table public.legal_documents enable row level security;

create policy legal_docs_pro_select on public.legal_documents
  for select to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));
