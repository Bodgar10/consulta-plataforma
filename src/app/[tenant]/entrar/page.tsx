import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { RequestLinkForm } from '@/components/funnel/RequestLinkForm';

export default async function EntrarPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ link?: string }>;
}) {
  const { tenant: paramSlug } = await params;
  const { link } = await searchParams;

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .rpc('public_get_tenant_by_slug', { p_slug: paramSlug })
    .maybeSingle();

  if (!tenant?.id) notFound();

  return (
    <main className="min-h-screen bg-cream-50 flex flex-col items-center justify-center px-4 gap-4">
      {link === 'error' && (
        <div className="card bg-danger-50 max-w-sm w-full">
          <p className="field-error">
            Tu enlace de acceso ya no es válido. Puede que haya expirado o que
            ya se haya usado. Pide uno nuevo abajo.
          </p>
        </div>
      )}
      <RequestLinkForm tenantId={tenant.id} />
    </main>
  );
}
