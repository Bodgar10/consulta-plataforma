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
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: paramSlug } = await params;
  const slug = await getTenantSlug(paramSlug);
  const tenant = slug ? await getTenant(slug) : null;

  if (!tenant || !slug) notFound();

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="page-title">Agenda tu sesión con {tenant.display_name}</h1>
        <BookingFlow
          tenantId={tenant.id}
          tenantSlug={slug}
          tenantTimezone={tenant.timezone}
          acceptsTransfer={tenant.payment_settings.accepts_transfer}
        />
      </div>
    </main>
  );
}
