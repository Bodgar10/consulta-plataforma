import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getTenantSlug } from "@/lib/tenant/get-tenant-slug";

export default async function TenantLandingPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: paramSlug } = await params;
  const slug = await getTenantSlug(paramSlug);

  if (!slug) notFound();

  const supabase = await createClient();

  const { data: tenant } = await supabase
    .rpc("public_get_tenant_by_slug", { p_slug: slug })
    .maybeSingle();

  if (!tenant?.id) notFound();

  const { data: landings } = await supabase.rpc("public_get_published_landings", {
    p_tenant_id: tenant.id,
  });

  const list = (landings ?? []) as { slug: string }[];
  if (list.length === 0) notFound();

  const chosen = list[Math.floor(Math.random() * list.length)];

  redirect(`/${slug}/l/${chosen.slug}`);
}
