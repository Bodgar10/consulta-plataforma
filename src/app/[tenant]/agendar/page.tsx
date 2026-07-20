import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import BookingFlow from "@/components/booking/BookingFlow";
import { getTenantSlug } from "@/lib/tenant/get-tenant-slug";

interface TenantData {
  id: string;
  display_name: string;
  timezone: string;
  payment_settings: {
    accepts_transfer: boolean;
    whatsapp: string | null;
    banco: string | null;
    titular: string | null;
    clabe: string | null;
    session_price_cents: number | null;
  };
}

async function getTenant(slug: string): Promise<TenantData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_get_tenant_by_slug", {
    p_slug: slug,
  });
  if (error || !data || data.length === 0) return null;
  return data[0] as unknown as TenantData;
}

export default async function AgendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ credito?: string }>;
}) {
  const { tenant: paramSlug } = await params;
  const { credito } = await searchParams;
  const slug = await getTenantSlug(paramSlug);
  const tenant = slug ? await getTenant(slug) : null;

  if (!tenant || !slug) notFound();

  let creditInfo: { available: boolean; email: string; full_name: string | null; workshop_title: string } | null = null;
  if (credito) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('public_get_workshop_credit_status', {
      p_download_id: credito,
    });
    creditInfo = data as typeof creditInfo;
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="page-title">Agenda tu sesión con {tenant.display_name}</h1>
          <p className="muted mt-2">
            Este es solo el primer paso. Elige el momento que te acomode, sin prisa.
          </p>
        </div>
        <BookingFlow
          tenantId={tenant.id}
          tenantSlug={slug}
          tenantTimezone={tenant.timezone}
          acceptsTransfer={tenant.payment_settings.accepts_transfer}
          sessionPriceCents={tenant.payment_settings.session_price_cents}
          creditInfo={creditInfo}
        />
      </div>
    </main>
  );
}
