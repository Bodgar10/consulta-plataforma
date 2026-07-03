import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getTenantSlug } from "@/lib/tenant/get-tenant-slug";

interface TenantData {
  id: string;
  display_name: string;
  branding: { logo_url?: string; tagline?: string };
  timezone: string;
}

async function getTenant(slug: string): Promise<TenantData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_get_tenant_by_slug", {
    p_slug: slug,
  });
  if (error || !data || data.length === 0) return null;
  return data[0] as TenantData;
}

export default async function TenantLandingPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: paramSlug } = await params;
  const slug = await getTenantSlug(paramSlug);
  const tenant = slug ? await getTenant(slug) : null;

  if (!tenant || !slug) notFound();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="page-title">{tenant.display_name}</h1>
        {tenant.branding?.tagline && (
          <p className="muted text-base">{tenant.branding.tagline}</p>
        )}
        <a href={`/${slug}/agendar`} className="btn-primary inline-flex mt-4">
          Agendar sesión
        </a>
      </div>
    </main>
  );
}
