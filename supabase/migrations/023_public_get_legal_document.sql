-- ============================================================
-- 023_public_get_legal_document.sql
-- Lectura pública (anon) de la versión legal VIGENTE de un tenant.
-- Contrato con Sonnet: /privacidad y /terminos renderizan desde aquí.
-- Depende de 022_legal_documents.
-- ============================================================

create or replace function public.public_get_legal_document(
  p_tenant_id uuid,
  p_doc_type  text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when d.id is null then null else jsonb_build_object(
    'doc_type', d.doc_type,
    'version', d.version,
    'content', d.content,
    'published_at', d.published_at
  ) end
  from public.legal_documents d
  where d.tenant_id = p_tenant_id
    and d.doc_type = p_doc_type
    and d.is_current
  limit 1
$$;

grant execute on function public.public_get_legal_document(uuid, text) to anon, authenticated;
