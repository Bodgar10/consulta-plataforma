import { NextRequest, NextResponse } from 'next/server';
import { getTenantContextById } from '@/lib/tenant/context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantId = new URL(req.url).searchParams.get('tenant_id');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id_requerido' }, { status: 400 });
  }
  try {
    const ctx = await getTenantContextById(tenantId);
    return NextResponse.json({
      tenant_id: ctx.tenant_id,
      slug: ctx.slug,
      display_name: ctx.display_name,
      timezone: ctx.timezone,
      currency: ctx.currency,
    });
  } catch {
    return NextResponse.json({ error: 'tenant_context_unavailable' }, { status: 404 });
  }
}
