import { createClient } from '@/utils/supabase/server';

export interface LegalSection { heading: string; body: string }
export interface LegalContent { title?: string; sections?: LegalSection[] }
export interface LegalDocument {
  doc_type: 'privacy' | 'terms';
  version: string;
  content: LegalContent;
  published_at: string;
}

/**
 * Lee la versión vigente de un documento legal para un tenant, vía la función
 * definer public_get_legal_document (contrato Opus O-A2). Devuelve null si no
 * hay versión publicada.
 */
export async function getLegalDocument(
  tenantId: string,
  docType: 'privacy' | 'terms',
): Promise<LegalDocument | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('public_get_legal_document', {
    p_tenant_id: tenantId,
    p_doc_type: docType,
  });
  if (error || !data) return null;
  return data as unknown as LegalDocument;
}
