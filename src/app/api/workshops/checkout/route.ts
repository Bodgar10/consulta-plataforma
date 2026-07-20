import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createCheckoutSession } from '@/lib/payments/checkout';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let tenantId = '', tenantSlug = '', workshopId = '', email = '', name = '';
  try {
    const b = await req.json();
    tenantId = String(b?.tenant_id ?? '');
    tenantSlug = String(b?.tenant_slug ?? '');
    workshopId = String(b?.workshop_id ?? '');
    email = String(b?.email ?? '').trim().toLowerCase();
    name = String(b?.name ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!tenantId || !tenantSlug || !workshopId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: workshop, error: wErr } = await supabase
    .from('pdf_workshops')
    .select('title, price_cents, published')
    .eq('id', workshopId)
    .eq('tenant_id', tenantId)
    .single();

  if (wErr || !workshop || !workshop.published || !workshop.price_cents) {
    return NextResponse.json({ error: 'workshop_unavailable' }, { status: 404 });
  }

  const { data: downloadId, error: regErr } = await supabase.rpc('public_register_paid_download', {
    p_tenant_id: tenantId,
    p_workshop_id: workshopId,
    p_email: email,
    p_name: name,
  });

  if (regErr) {
    return NextResponse.json({ error: 'register_failed', message: regErr.message }, { status: 400 });
  }

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('payment_settings')
    .eq('id', tenantId)
    .eq('status', 'active')
    .single();

  const stripeAccountId = (tenant?.payment_settings as Record<string, unknown> | null)?.['stripe_account_id'] as string | undefined;
  if (tErr || !stripeAccountId) {
    return NextResponse.json({ error: 'connect_not_ready' }, { status: 409 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const session = await createCheckoutSession({
    stripeAccountId,
    amountCents: workshop.price_cents,
    productName: workshop.title,
    customerEmail: email,
    method: 'card',
    successUrl: `${base}/${tenantSlug}/taller/${workshopId}?pago=ok&download=${downloadId}`,
    cancelUrl: `${base}/${tenantSlug}/taller/${workshopId}?pago=cancelado`,
    metadata: {
      download_id: String(downloadId),
      workshop_id: workshopId,
      tenant_id: tenantId,
    },
  });

  return NextResponse.json({ checkout_url: session.url });
}
