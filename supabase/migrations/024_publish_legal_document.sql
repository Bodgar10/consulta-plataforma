-- ============================================================
-- 024_publish_legal_document.sql
-- El owner publica una nueva versión de un documento legal. Atómico:
-- apaga la vigente anterior y marca la nueva como is_current. Bajo owner.
-- Depende de 022_legal_documents.
-- ============================================================

create or replace function public.professional_publish_legal_document(
  p_doc_type text,
  p_version  text,
  p_content  jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_id uuid;
begin
  if p_doc_type not in ('privacy','terms') then
    raise exception 'doc_type inválido: %', p_doc_type;
  end if;
  if coalesce(p_version,'') = '' then
    raise exception 'version requerida';
  end if;

  -- Deriva el tenant del owner autenticado (no se confía en un argumento).
  select tenant_id into v_tenant_id
  from public.tenant_members
  where auth_user_id = auth.uid() and role = 'owner'
  limit 1;

  if v_tenant_id is null then
    raise exception 'solo el owner puede publicar documentos legales';
  end if;

  -- Apaga la vigente anterior del mismo tipo (si la hay) ANTES de insertar la nueva,
  -- para no violar el índice único parcial de is_current.
  update public.legal_documents
    set is_current = false
    where tenant_id = v_tenant_id and doc_type = p_doc_type and is_current;

  insert into public.legal_documents (tenant_id, doc_type, version, content, is_current)
  values (v_tenant_id, p_doc_type, p_version, coalesce(p_content, '{}'::jsonb), true)
  on conflict (tenant_id, doc_type, version) do update
    set content = excluded.content,
        is_current = true,
        published_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.professional_publish_legal_document(text, text, jsonb) to authenticated;
