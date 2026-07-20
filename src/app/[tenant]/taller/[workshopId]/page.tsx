import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createSignedDownloadUrl } from '@/lib/storage/workshop-files';
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
  searchParams,
}: {
  params: Promise<{ tenant: string; workshopId: string }>;
  searchParams: Promise<{ pago?: string; download?: string }>;
}) {
  const { tenant: tenantSlug, workshopId } = await params;
  const { pago, download } = await searchParams;
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

  // Vuelta exitosa de Stripe: resolver la compra y mostrar la confirmación
  // real, en vez de repetir el formulario de compra.
  if (pago === 'ok' && download) {
    const admin = createAdminClient();
    const { data: purchase } = await admin
      .from('pdf_workshop_downloads')
      .select('payment_status, credit_id')
      .eq('id', download)
      .eq('tenant_id', tenant.id)
      .single();

    if (purchase && (purchase.payment_status === 'paid' || purchase.payment_status === 'free')) {
      const { data: workshopRow } = await admin
        .from('pdf_workshops')
        .select('file_path')
        .eq('id', workshopId)
        .single();

      const downloadUrl = workshopRow?.file_path
        ? await createSignedDownloadUrl(workshopRow.file_path)
        : null;

      const freeSessionUrl = purchase.credit_id
        ? `/${tenantSlug}/agendar?credito=${download}`
        : null;

      return (
        <main className="min-h-screen bg-cream-50 flex justify-center px-4 py-12">
          <div className="card max-w-lg w-full text-center">
            <h1 className="page-title">¡Listo! Ya es tuyo.</h1>
            <p className="muted mt-2">Te enviamos una copia de &quot;{data.title}&quot; a tu correo también.</p>

            {downloadUrl && (
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-5 inline-block">
                Descargar PDF ahora
              </a>
            )}

            {freeSessionUrl && (
              <div className="mt-6 bg-pine-50 rounded-[14px] p-5">
                <p className="text-pine-700 font-medium mb-1">Tu compra incluye una sesión de terapia gratis</p>
                <p className="muted mb-4">Te recomendamos leer el material primero, para llegar preparado(a).</p>
                <a href={freeSessionUrl} className="btn-primary inline-block">
                  Agenda mi cita gratis
                </a>
              </div>
            )}
          </div>
        </main>
      );
    }
  }

  return (
    <main className="min-h-screen bg-cream-50 flex justify-center px-4 py-12">
      <div className="card max-w-lg w-full">
        <h1 className="page-title">{data.title}</h1>
        {data.description && <p className="text-body text-pine-900 mt-3">{data.description}</p>}

        <p className="section-title text-clay-600 mt-5">{formatPrice(data.price_cents)}</p>

        {data.grants_free_session && (
          <div className="inline-flex items-center gap-1.5 bg-pine-50 text-pine-700 rounded-full px-3 py-1.5 mt-3">
            <span className="text-sm font-medium">✦ Incluye una sesión de terapia gratis</span>
          </div>
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
