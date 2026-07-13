import { createClient } from '@/utils/supabase/server';
import { getTenantSlug } from '@/lib/tenant/get-tenant-slug';
import { getLegalDocument } from '@/lib/legal/get-legal-document';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';

export const metadata = { title: 'Términos y condiciones' };

async function getTenantId(slug: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('public_get_tenant_by_slug', { p_slug: slug });
  if (error || !data || data.length === 0) return null;
  return (data[0] as unknown as { id: string }).id;
}

export default async function TerminosPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: paramSlug } = await params;
  const slug = await getTenantSlug(paramSlug);
  const tenantId = slug ? await getTenantId(slug) : null;
  const doc = tenantId ? await getLegalDocument(tenantId, 'terms') : null;
  return <LegalDocumentView doc={doc} fallbackTitle="Términos y condiciones" />;
}
