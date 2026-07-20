import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { WorkshopRegister } from '@/components/workshops/WorkshopRegister';

interface Workshop {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  grants_free_session: boolean;
}

function formatPrice(cents: number | null) {
  if (!cents) return 'Gratis';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cents / 100);
}

export default async function WorkshopPage({
  params,
}: {
  params: Promise<{ tenant: string; workshopId: string }>;
}) {
  const { tenant: tenantSlug, workshopId } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .rpc('public_get_tenant_by_slug', { p_slug: tenantSlug })
    .maybeSingle();

  if (!tenant?.id) notFound();

  const { data: workshops } = await supabase.rpc('public_get_pdf_workshops', {
    p_tenant_id: tenant.id,
  });

  const data = (workshops as Workshop[] | null)?.find((w) => w.id === workshopId);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-cream-50 flex justify-center px-4 py-12">
      <div className="card max-w-lg w-full">
        <h1 className="page-title">{data.title}</h1>
        {data.description && <p className="text-body text-pine-900 mt-3">{data.description}</p>}

        <p className="section-title text-clay-600 mt-5">{formatPrice(data.price_cents)}</p>

        {data.grants_free_session && (
          <p className="muted mt-1">Incluye una sesión de terapia gratis.</p>
        )}

        <div className="mt-6">
          <WorkshopRegister
            tenantId={tenant.id}
            tenantSlug={tenantSlug}
            workshopId={data.id}
            priceCents={data.price_cents}
          />
        </div>
      </div>
    </main>
  );
}
